package com.calm.feature.questionnaire;

import com.calm.feature.risk.AccountDeletedEvent;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import static com.calm.feature.questionnaire.CycleMarker.Kind.*;

@Service
public class CycleMarkerService {
    private final CycleMarkerRepository markers;
    private final QuestionnaireProfileRepository profiles;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public CycleMarkerService(CycleMarkerRepository markers, QuestionnaireProfileRepository profiles) {
        this(markers, profiles, Clock.systemUTC());
    }

    CycleMarkerService(CycleMarkerRepository markers, QuestionnaireProfileRepository profiles, Clock clock) {
        this.markers = markers; this.profiles = profiles; this.clock = clock;
    }

    public record Marker(LocalDate date, CycleMarker.Kind kind, LocalDate plannedEnd) {
        public Marker(LocalDate date, CycleMarker.Kind kind) { this(date, kind, null); }
    }

    public List<Marker> list(String userId) {
        var all=markers.findByUserIdOrderByDateAsc(userId);
        var result=new ArrayList<Marker>();
        knownDays(all.stream().filter(m -> !legacyPlan(m)).toList(), Instant.MAX).keySet().stream().sorted()
                .forEach(day -> result.add(new Marker(day, DAY)));
        all.stream().filter(m -> m.kind() == CLOSED || m.kind() == END || m.kind() == PLANNED || legacyPlan(m))
                .map(m -> new Marker(m.date(), legacyPlan(m) ? PLANNED : m.kind() == END ? CLOSED : m.kind(), m.plannedEnd()))
                .distinct().forEach(result::add);
        return result;
    }

    static boolean legacyPlan(CycleMarker marker) {
        // Old clients stored future calendar days as DAY without saving the timezone.
        return marker.kind() == DAY && "CALENDAR".equals(marker.source())
                && marker.date().isAfter(marker.recordedAt().atOffset(ZoneOffset.ofHours(14)).toLocalDate());
    }

    /** A legacy pair becomes selected days only after its end was known. */
    static Map<LocalDate, Instant> knownDays(List<CycleMarker> all, Instant at) {
        Map<LocalDate, Instant> days = new LinkedHashMap<>();
        var ordered = new ArrayList<>(all);
        ordered.sort(Comparator.comparing(CycleMarker::date).thenComparing(m -> m.kind()==CycleMarker.Kind.START ? 0 : 1));
        CycleMarker start = null;
        for (var marker: ordered) {
            if (marker.recordedAt().isAfter(at)) continue;
            if (marker.kind()==CycleMarker.Kind.DAY) { days.put(marker.date(), marker.recordedAt()); continue; }
            if (marker.kind()!=START && marker.kind()!=END) continue;
            if (marker.kind()==CycleMarker.Kind.START) {
                if (start!=null) days.putIfAbsent(start.date(), start.recordedAt());
                start=marker;
            } else if (start!=null && !marker.date().isBefore(start.date())) {
                var knownAt=start.recordedAt().isAfter(marker.recordedAt())?start.recordedAt():marker.recordedAt();
                for (var date=start.date(); !date.isAfter(marker.date()) && !date.isAfter(start.date().plusDays(90)); date=date.plusDays(1))
                    days.putIfAbsent(date, knownAt);
                start=null;
            } else days.putIfAbsent(marker.date(), marker.recordedAt());
        }
        if (start!=null) days.putIfAbsent(start.date(), start.recordedAt());
        return days;
    }

    private void materializeLegacy(String userId) {
        var all=markers.findByUserIdOrderByDateAsc(userId);
        if (all.stream().noneMatch(m -> m.kind()==CycleMarker.Kind.START || m.kind()==CycleMarker.Kind.END)) return;
        knownDays(all, Instant.MAX).forEach((date, recordedAt) -> {
            var id=CycleMarker.key(userId,date,CycleMarker.Kind.DAY);
            if (markers.findById(id).isEmpty()) markers.save(new CycleMarker(id,userId,date,CycleMarker.Kind.DAY,recordedAt,"LEGACY"));
        });
        all.stream().filter(m -> m.kind()==CycleMarker.Kind.END).forEach(m -> {
            var id=CycleMarker.key(userId,m.date(),CycleMarker.Kind.CLOSED);
            if (markers.findById(id).isEmpty()) markers.save(new CycleMarker(id,userId,m.date(),CycleMarker.Kind.CLOSED,m.recordedAt()));
        });
        all.stream().filter(m -> m.kind()==CycleMarker.Kind.START || m.kind()==CycleMarker.Kind.END).forEach(m -> markers.deleteById(m.id()));
    }

    private void validate(String userId, LocalDate date, String timezone) {
        if (profiles.findById(userId).map(QuestionnaireProfile::sex).orElse(null) != QuestionnaireProfile.Sex.FEMALE)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Отметки цикла доступны при женском поле в профиле");
        if (date == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Выберите дату");
        try {
            ZoneId.of(timezone);
        } catch (java.time.DateTimeException | NullPointerException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Проверьте часовой пояс");
        }
    }

    public synchronized Marker put(String userId, LocalDate date, CycleMarker.Kind kind, String timezone) {
        validate(userId, date, timezone);
        if (kind!=CycleMarker.Kind.DAY && kind!=CycleMarker.Kind.CLOSED) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Выберите день менструации");
        var today = clock.instant().atZone(ZoneId.of(timezone)).toLocalDate();
        if (kind == DAY && date.isAfter(today)) {
            save(userId, date, PLANNED, "CALENDAR");
            return new Marker(date, PLANNED);
        }
        materializeLegacy(userId);
        if (kind==CycleMarker.Kind.CLOSED) {
            var period = history(userId, date).latest();
            if (date.isAfter(today) || period == null || !date.equals(period.lastMarked()))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Выберите отмеченный прошедший день цикла");
            saveClosing(userId, period.start(), date, "CALENDAR");
        } else {
            save(userId, date, DAY, "CALENDAR");
        }
        return new Marker(date, kind);
    }

    public synchronized void remove(String userId, LocalDate date, CycleMarker.Kind kind, String timezone) {
        validate(userId, date, timezone);
        if (kind != DAY && kind != CLOSED && kind != PLANNED) throw invalid("Выберите день менструации");
        materializeLegacy(userId);
        if (kind == PLANNED) {
            markers.findById(CycleMarker.key(userId, date, DAY)).filter(CycleMarkerService::legacyPlan)
                    .ifPresent(marker -> markers.deleteById(marker.id()));
        }
        if (kind == CLOSED || kind == DAY) {
            var auto = markers.findById(CycleMarker.key(userId, date, CLOSED)).filter(m -> "AUTO".equals(m.source()));
            if (auto.isPresent()) {
                var period = history(userId, date).latest();
                if (period != null) save(userId, period.start(), REOPENED, "CALENDAR");
            }
        }
        markers.deleteById(CycleMarker.key(userId, date, kind));
        if (kind == DAY) {
            markers.deleteById(CycleMarker.key(userId, date, PLANNED));
            markers.deleteById(CycleMarker.key(userId, date, CLOSED));
            markers.deleteById(CycleMarker.key(userId, date, BEGIN));
            markers.deleteById(CycleMarker.key(userId, date, SEPARATE));
            markers.deleteById(CycleMarker.key(userId, date, REOPENED));
        }
    }

    CycleHistory.Timeline history(String userId, LocalDate today) {
        return CycleHistory.from(markers.findByUserIdOrderByDateAsc(userId), today, clock.instant());
    }

    synchronized CycleHistory.Timeline closeOverdue(String userId, LocalDate today) {
        var all = markers.findByUserIdOrderByDateAsc(userId);
        for (var marker : all) {
            if (!legacyPlan(marker)) continue;
            var id = CycleMarker.key(userId, marker.date(), PLANNED);
            if (markers.findById(id).isEmpty()) {
                markers.save(new CycleMarker(id, userId, marker.date(), PLANNED, marker.recordedAt(), marker.source()));
            }
            markers.deleteById(marker.id());
        }
        var timeline = CycleHistory.from(all, today, clock.instant());
        var latest = timeline.latest();
        if (latest == null || latest.end() != null || today.isBefore(latest.start().plusDays(9))
                || has(userId, latest.start(), REOPENED)) return timeline;
        long duration = Math.min(10, Math.max(1, Math.round(timeline.statistics().periodLength())));
        var end = latest.start().plusDays(duration - 1);
        if (latest.lastMarked().isAfter(end)) end = latest.lastMarked();
        recordEnd(userId, latest.start(), end, "AUTO");
        return history(userId, today);
    }

    public synchronized void range(String userId, LocalDate start, LocalDate end, String timezone) {
        validate(userId, start, timezone);
        var today = clock.instant().atZone(ZoneId.of(timezone)).toLocalDate();
        if (end == null || end.isBefore(start) || end.isAfter(start.plusDays(90))) throw invalid("Проверьте даты начала и окончания");
        if (start.isAfter(today)) {
            savePlan(userId, start, start.equals(end) ? null : end, "CALENDAR");
            return;
        }
        recordStart(userId, start, "CALENDAR");
        if (end.isAfter(today)) {
            for (var date = start; !date.isAfter(today); date = date.plusDays(1)) save(userId, date, DAY, "CALENDAR");
            savePlan(userId, start, end, "CALENDAR");
            return;
        }
        if (!start.equals(end)) recordEnd(userId, start, end, "CALENDAR");
    }

    synchronized void recordStart(String userId, LocalDate date, String source) {
        materializeLegacy(userId);
        save(userId, date, DAY, source);
        save(userId, date, BEGIN, source);
        markers.deleteById(CycleMarker.key(userId, date, PLANNED));
    }

    synchronized void recordEnd(String userId, LocalDate start, LocalDate end, String source) {
        if (end.isBefore(start) || end.isAfter(start.plusDays(90))) throw invalid("Проверьте дату окончания");
        materializeLegacy(userId);
        for (var date = start; !date.isAfter(end); date = date.plusDays(1)) save(userId, date, DAY, source);
        saveClosing(userId, start, end, source);
        markers.deleteById(CycleMarker.key(userId, start, PLANNED));
    }

    synchronized void correctAutoEnd(String userId, CycleHistory.Period period, LocalDate end) {
        recordEnd(userId, period.start(), end, "CARD");
        if (!period.end().equals(end)) markers.deleteById(CycleMarker.key(userId, period.end(), CLOSED));
        else markers.save(new CycleMarker(CycleMarker.key(userId, end, CLOSED), userId, end, CLOSED, clock.instant(), "CARD", period.start()));
        markers.findByUserIdOrderByDateAsc(userId).stream().filter(marker -> marker.kind() == DAY
                && "AUTO".equals(marker.source()) && marker.date().isAfter(end) && !marker.date().isAfter(period.end()))
                .forEach(marker -> markers.deleteById(marker.id()));
    }

    synchronized void merge(String userId, CycleHistory.Period previous, CycleHistory.Period latest) {
        for (var date = previous.start(); !date.isAfter(latest.lastMarked()); date = date.plusDays(1)) {
            save(userId, date, DAY, "CARD");
        }
        if (latest.end() != null) {
            var id = CycleMarker.key(userId, latest.end(), CLOSED);
            markers.findById(id).ifPresent(marker -> markers.save(new CycleMarker(id, userId, latest.end(),
                    CLOSED, marker.recordedAt(), marker.source(), previous.start())));
        }
        if (previous.end() != null && !previous.end().equals(latest.end())) {
            markers.deleteById(CycleMarker.key(userId, previous.end(), CLOSED));
        }
        markers.deleteById(CycleMarker.key(userId, latest.start(), BEGIN));
        markers.deleteById(CycleMarker.key(userId, latest.start(), SEPARATE));
    }

    synchronized void separate(String userId, LocalDate start) { save(userId, start, SEPARATE, "CARD"); }

    synchronized void movePlan(String userId, LocalDate oldDate, LocalDate newDate) {
        if (newDate != null) {
            var end = markers.findById(CycleMarker.key(userId, oldDate, PLANNED)).map(CycleMarker::plannedEnd)
                    .map(date -> newDate.plusDays(ChronoUnit.DAYS.between(oldDate, date)))
                    .orElse(null);
            savePlan(userId, newDate, end, "CARD");
        }
        if (!oldDate.equals(newDate)) {
            markers.deleteById(CycleMarker.key(userId, oldDate, PLANNED));
        }
    }

    boolean has(String userId, LocalDate date, CycleMarker.Kind kind) {
        return markers.findById(CycleMarker.key(userId, date, kind)).isPresent();
    }

    private void save(String userId, LocalDate date, CycleMarker.Kind kind, String source) {
        var id = CycleMarker.key(userId, date, kind);
        if (markers.findById(id).isEmpty()) markers.save(new CycleMarker(id, userId, date, kind, clock.instant(), source));
    }

    private void savePlan(String userId, LocalDate start, LocalDate end, String source) {
        var id = CycleMarker.key(userId, start, PLANNED);
        var current = markers.findById(id).orElse(null);
        if (current == null || end != null && !end.equals(current.plannedEnd())) {
            markers.save(new CycleMarker(id, userId, start, PLANNED, clock.instant(), source, null, end));
        }
    }

    private void saveClosing(String userId, LocalDate start, LocalDate end, String source) {
        var id = CycleMarker.key(userId, end, CLOSED);
        if (markers.findById(id).isEmpty()) markers.save(new CycleMarker(id, userId, end, CLOSED, clock.instant(), source, start));
    }

    private static ResponseStatusException invalid(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    @EventListener public void deleted(AccountDeletedEvent event) { markers.deleteByUserId(event.userId()); }
}
