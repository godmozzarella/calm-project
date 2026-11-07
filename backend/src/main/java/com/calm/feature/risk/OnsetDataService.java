package com.calm.feature.risk;

import com.calm.feature.attack.Attack;
import com.calm.feature.attack.AttackRepository;
import com.calm.feature.forecast.ForecastService;
import com.calm.feature.forecast.dto.ForecastResponse;
import com.calm.feature.medication.Medication;
import com.calm.feature.medication.MedicationRepository;
import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class OnsetDataService {
    private static final Logger log = LoggerFactory.getLogger(OnsetDataService.class);
    private final SharedModelParticipationRepository participation;
    private final UserRepository users;
    private final AttackRepository attacks;
    private final MedicationRepository medications;
    private final DailyOutcomeRepository outcomes;
    private final OnsetInputRepository inputs;
    private final OnsetLabelRepository labels;
    private final ForecastService forecasts;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public OnsetDataService(SharedModelParticipationRepository participation, UserRepository users,
            AttackRepository attacks, MedicationRepository medications, DailyOutcomeRepository outcomes,
            OnsetInputRepository inputs, OnsetLabelRepository labels, ForecastService forecasts) {
        this(participation, users, attacks, medications, outcomes, inputs, labels, forecasts, Clock.systemUTC());
    }

    OnsetDataService(SharedModelParticipationRepository participation, UserRepository users,
            AttackRepository attacks, MedicationRepository medications, DailyOutcomeRepository outcomes,
            OnsetInputRepository inputs, OnsetLabelRepository labels, ForecastService forecasts, Clock clock) {
        this.participation = participation; this.users = users; this.attacks = attacks;
        this.medications = medications; this.outcomes = outcomes; this.inputs = inputs;
        this.labels = labels; this.forecasts = forecasts; this.clock = clock;
    }

    private boolean consented(String userId) {
        return participation.findByUserId(userId).filter(p -> p.isParticipating() && !p.isAdminBlocked()
                && SharedModelConsentPolicy.VERSION.equals(p.getConsentVersion())
                && SharedModelConsentPolicy.DIGEST.equals(p.getConsentDigest())).isPresent();
    }

    @EventListener
    public void diaryChanged(DiaryChangedEvent event) {
        // The diary edit has already succeeded. Periodic reconciliation retries failures.
        try { refreshLabels(event.userId()); }
        catch (RuntimeException e) { log.warn("Onset labels pending reconciliation: {}", e.getClass().getSimpleName()); }
    }

    @EventListener
    public void accountDeleted(AccountDeletedEvent event) { purge(event.userId()); }

    private void purge(String userId) {
        inputs.deleteByUserId(userId);
        labels.deleteByUserId(userId);
    }

    @Scheduled(cron = "${calm.risk-pilot.onset-cron:0 * * * * *}")
    public void tick() {
        for (var p : participation.findAll()) {
            try {
                if (!consented(p.getUserId())) { purge(p.getUserId()); continue; }
                var user = users.findById(p.getUserId()).orElse(null);
                if (user == null) { purge(p.getUserId()); continue; }
                var local = clock.instant().atZone(knownZone(user).orElse(ZoneOffset.UTC));
                // Prepare within the final minute BEFORE midnight; never pretend later facts existed at 00:00.
                if (local.getHour() == 23 && local.getMinute() == 59) {
                    capture(user, local.toLocalDate().plusDays(1));
                } else if (local.getHour() == 0 && local.getMinute() < 5) {
                    // A missed/slow capture is recorded explicitly as unusable for the midnight protocol.
                    capture(user, local.toLocalDate());
                }
                refreshLabels(user.getId());
            } catch (RuntimeException e) {
                log.warn("Onset collection pending retry: {}", e.getClass().getSimpleName());
            }
        }
    }

    public void capture(User user, LocalDate target) {
        if (!consented(user.getId())) return;
        String id = OnsetInputSnapshot.key(user.getId(), target);
        if (inputs.existsById(id)) return;
        var knownZone = knownZone(user);
        ZoneId zone = knownZone.orElse(ZoneOffset.UTC);
        Instant boundary = target.atStartOfDay(zone).toInstant();
        List<String> flags = new ArrayList<>();
        if (knownZone.isEmpty()) flags.add("TIMEZONE_UNKNOWN");
        Map<String, Object> weather = new LinkedHashMap<>();
        ForecastResponse response = null;
        if (user.getLatitude() != null && user.getLongitude() != null) {
            try { response = forecasts.getForecast(user.getLatitude(), user.getLongitude()); }
            catch (RuntimeException e) { flags.add("WEATHER_UNAVAILABLE"); }
        } else flags.add("LOCATION_MISSING");
        if (response != null) {
            weather.put("provider", response.provider());
            weather.put("fetchedAt", response.cachedAt());
            weather.put("stale", response.stale());
            weather.put("locationGrid", String.format(Locale.ROOT, "%.1f,%.1f", user.getLatitude(), user.getLongitude()));
            var forecast = response.days().stream().filter(d -> target.equals(d.date())).findFirst();
            forecast.ifPresent(d -> {
                weather.put("pressureMmHg", d.pressureMmHg()); weather.put("pressureDelta24hMmHg", d.pressureDelta24hMmHg());
                weather.put("humidity", d.humidity()); weather.put("humidityDelta24h", d.humidityDelta24h());
                weather.put("tempMin", d.tempMin()); weather.put("tempMax", d.tempMax());
                weather.put("windKmhMax", d.windKmhMax()); weather.put("kpIndex", d.kpIndex());
                weather.put("forecastTimezone", d.timezone());
            });
            if (forecast.isEmpty()) flags.add("TARGET_FORECAST_MISSING");
            if (response.stale()) flags.add("STALE_FORECAST");
        }
        Instant readAt = clock.instant();
        List<Attack> history = attacks.findInRange(user.getId(), target.minusDays(90), target)
                .stream().filter(a -> a.getStartDate() != null && a.getStartDate().isBefore(target))
                .filter(a -> occurredBy(a.getStartDate(), a.getStartTime(), readAt, zone)).toList();
        List<Medication> meds = medications.findInRange(user.getId(), target.minusDays(30), target)
                .stream().filter(m -> m.getDate() != null && m.getDate().isBefore(target))
                .filter(m -> occurredBy(m.getDate(), m.getTime(), readAt, zone)).toList();
        var marks = outcomes.findByUserIdAndDateBetween(user.getId(), target.minusDays(90), target.minusDays(1));
        Map<String, Object> features = new LinkedHashMap<>();
        for (int days : new int[]{3, 7, 14, 30, 90}) {
            features.put("episodeStartsLast" + days + "Days", history.stream()
                    .filter(a -> !a.getStartDate().isBefore(target.minusDays(days))).count());
        }
        features.put("medicationDaysLast7Days", meds.stream().map(Medication::getDate)
                .filter(d -> !d.isBefore(target.minusDays(7))).distinct().count());
        features.put("observedNoNewStartDaysLast30Days", marks.stream()
                .filter(m -> !m.getDate().isBefore(target.minusDays(30))).map(DailyOutcome::getDate).distinct().count());
        features.put("daysSinceLastAttackStart", history.stream().map(Attack::getStartDate).max(Comparator.naturalOrder())
                .map(d -> ChronoUnit.DAYS.between(d, target)).orElse(null));
        features.put("meanAttackIntensityLast30Days", history.stream()
                .filter(a -> !a.getStartDate().isBefore(target.minusDays(30)))
                .mapToInt(Attack::getIntensity).filter(v -> v >= 1 && v <= 10).average().stream().boxed().findFirst().orElse(null));
        boolean reportedOngoing = history.stream().anyMatch(a -> a.isOngoing() && a.overlaps(readAt.atZone(zone).toLocalDate()));
        // No record is not an explicit report of no pain. A daily state check-in is a later feature.
        features.put("ongoingAtIssue", reportedOngoing ? Boolean.TRUE : null);
        features.put("historyDetails", TrainingHistoryDetails.from(history, meds, target, readAt.atZone(zone).toLocalDate()));
        Instant capturedAt = clock.instant();
        boolean onTime = !capturedAt.isAfter(boundary) && !capturedAt.isBefore(boundary.minusSeconds(60));
        if (!onTime) flags.add("OUTSIDE_MIDNIGHT_CAPTURE_WINDOW");
        if (!consented(user.getId())) return;
        var snapshot = new OnsetInputSnapshot(id, user.getId(), target, zone.getId(), boundary,
                target.plusDays(1).atStartOfDay(zone).toInstant(), capturedAt, 4,
                OnsetInputSnapshot.PROTOCOL, DailyOutcome.NEW_START_DEFINITION,
                SharedModelConsentPolicy.VERSION, SharedModelConsentPolicy.DIGEST,
                features, weather, onTime && knownZone.isPresent(), List.copyOf(flags));
        try { inputs.insert(snapshot); }
        catch (DuplicateKeyException ignored) { /* first capture wins, never overwrite */ }
    }

    private Optional<ZoneId> knownZone(User user) {
        if (user.hasLocationTimezone()) return Optional.of(ZoneId.of(user.getLocationTimezone()));
        // An explicit browser timezone on a mark also permits collection without a weather location.
        return outcomes.findByUserId(user.getId()).stream().filter(m -> m.getTimezone() != null)
            .max(Comparator.comparing(DailyOutcome::getConfirmedAt, Comparator.nullsFirst(Comparator.naturalOrder())))
            .map(m -> ZoneId.of(m.getTimezone()));
    }

    private static boolean occurredBy(LocalDate date, LocalTime time, Instant now, ZoneId zone) {
        return date != null && !date.atTime(time == null ? LocalTime.MAX : time).atZone(zone).toInstant().isAfter(now);
    }

    public void refreshLabels(String userId) {
        if (!consented(userId)) { purge(userId); return; }
        var user = users.findById(userId).orElse(null);
        if (user == null) { purge(userId); return; }
        var history = attacks.findByUserIdOrderByStartDateDescStartTimeDesc(userId);
        var marks = new HashMap<LocalDate, DailyOutcome>();
        outcomes.findByUserId(userId).forEach(m -> marks.put(m.getDate(), m));
        var snapshots = new HashMap<LocalDate, OnsetInputSnapshot>();
        inputs.findByUserId(userId).forEach(s -> snapshots.put(s.targetDate(), s));
        Set<LocalDate> dates = new HashSet<>(marks.keySet());
        dates.addAll(snapshots.keySet());
        // Existing labels must also be revisited after deletion/moving of the final attack/mark.
        labels.findByUserId(userId).forEach(l -> dates.add(l.targetDate()));
        history.stream().map(Attack::getStartDate).filter(Objects::nonNull).forEach(dates::add);
        Instant now = clock.instant();
        for (LocalDate day : dates) {
            var snapshot = snapshots.get(day);
            var mark = marks.get(day);
            String tz = snapshot != null ? snapshot.timezone() : mark != null && mark.getTimezone() != null
                    ? mark.getTimezone() : user.getLocationTimezone();
            ZoneId zone = ZoneId.of(tz);
            if (day.isAfter(now.atZone(zone).toLocalDate())) continue;
            var started = history.stream().filter(a -> day.equals(a.getStartDate()))
                    .map(Attack::getId).filter(Objects::nonNull).sorted().toList();
            Integer y = !started.isEmpty() ? Integer.valueOf(1) : mark != null ? Integer.valueOf(0) : null;
            boolean pain = history.stream().anyMatch(a -> a.overlaps(day));
            Boolean headache = pain ? Boolean.TRUE : mark != null && !DailyOutcome.NEW_START_DEFINITION.equals(mark.getOutcomeDefinition())
                    ? Boolean.FALSE : null;
            Instant end = day.plusDays(1).atStartOfDay(zone).toInstant();
            boolean completed = !now.isBefore(end);
            String source = !started.isEmpty() ? "ATTACK_START" : mark == null ? "UNKNOWN"
                    : DailyOutcome.NEW_START_DEFINITION.equals(mark.getOutcomeDefinition())
                    ? "USER_NO_NEW_START_MARK" : "LEGACY_NO_PAIN_MARK";
            saveLabel(userId, day, tz, y, headache, completed, end, source,
                    mark == null ? null : mark.getConfirmedAt(), started, now);
        }
    }

    private void saveLabel(String userId, LocalDate day, String tz, Integer y, Boolean headache,
            boolean completed, Instant end, String source, Instant markedAt, List<String> started, Instant now) {
        String id = OnsetInputSnapshot.key(userId, day);
        for (int attempt = 0; attempt < 3; attempt++) {
            var old = labels.findById(id).orElse(null);
            if (old != null && Objects.equals(old.outcome(), y) && Objects.equals(old.headachePresent(), headache)
                    && old.dayCompleted() == completed && old.timezone().equals(tz)
                    && old.labelSource().equals(source) && Objects.equals(old.markedAt(), markedAt)
                    && old.matchedAttackIds().equals(started)) return;
            long revision = old == null ? 1 : old.revision() + 1;
            var revisions = new ArrayList<OnsetDailyLabel.Revision>(old == null ? List.of() : old.revisions());
            revisions.add(new OnsetDailyLabel.Revision(revision, now, y, headache, completed, source, markedAt, started));
            try {
                labels.save(new OnsetDailyLabel(id, userId, day, tz, y, headache, completed,
                        completed ? end : null, source, markedAt, now, revision, started,
                        revisions, old == null ? null : old.lockVersion()));
                return;
            } catch (OptimisticLockingFailureException | DuplicateKeyException conflict) {
                if (attempt == 2) throw conflict;
            }
        }
    }
}
