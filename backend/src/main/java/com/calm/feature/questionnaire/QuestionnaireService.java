package com.calm.feature.questionnaire;

import com.calm.feature.attack.*;
import com.calm.feature.medication.*;
import com.calm.feature.user.*;
import com.calm.feature.risk.*;
import com.calm.feature.forecast.ForecastService;
import org.springframework.stereotype.Service;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.dao.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import static com.calm.feature.questionnaire.DailyQuestionnaire.*;

@Service
public class QuestionnaireService {
    private final QuestionnaireRepository entries;
    private final QuestionnaireProfileRepository profiles;
    private final CycleMarkerRepository cycleMarkers;
    private final AttackRepository attacks;
    private final MedicationRepository medications;
    private final UserRepository users;
    private final ForecastService forecasts;
    private final SharedModelParticipationRepository participation;
    private final Clock clock;
    @org.springframework.beans.factory.annotation.Autowired
    public QuestionnaireService(QuestionnaireRepository entries, QuestionnaireProfileRepository profiles, CycleMarkerRepository cycleMarkers,
            AttackRepository attacks, MedicationRepository medications, UserRepository users,
            ForecastService forecasts, SharedModelParticipationRepository participation) {
        this(entries, profiles, cycleMarkers, attacks, medications, users, forecasts, participation, Clock.systemUTC());
    }
    QuestionnaireService(QuestionnaireRepository entries, QuestionnaireProfileRepository profiles, CycleMarkerRepository cycleMarkers,
            AttackRepository attacks, MedicationRepository medications, UserRepository users,
            ForecastService forecasts, SharedModelParticipationRepository participation, Clock clock) {
        this.entries=entries; this.profiles=profiles; this.cycleMarkers=cycleMarkers; this.attacks=attacks; this.medications=medications;
        this.users=users; this.forecasts=forecasts; this.participation=participation; this.clock=clock;
    }
    public record Status(LocalDate date, QuestionnaireProfile profile, DailyQuestionnaire today,
            int currentStreak) {}
    public record Result(DailyQuestionnaire entry, boolean newCompletion, int currentStreak) {}
    public List<LocalDate> completedDates(String userId) {
        return entries.findCompletedDates(userId).stream()
                .map(QuestionnaireRepository.CompletedDate::date).filter(Objects::nonNull).toList();
    }
    private static ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,message); }
    private static ZoneId zone(String timezone) {
        try { return ZoneId.of(timezone); } catch (RuntimeException e) { throw invalid("Укажите корректный часовой пояс"); }
    }
    public Status status(String userId, String timezone) {
        var today=clock.instant().atZone(zone(timezone)).toLocalDate();
        var all=entries.findByUserId(userId);
        var profile=profiles.findById(userId).orElse(null);
        return new Status(today, profile,
                all.stream().filter(e -> today.equals(e.date())).findFirst().orElse(null), streak(all,today));
    }
    public QuestionnaireProfile profile(String userId) { return profiles.findById(userId).orElse(null); }
    public QuestionnaireProfile profile(String userId, QuestionnaireProfile p) {
        if(p.sex()==null || p.age()!=null && (p.age()<1 || p.age()>120)) throw invalid("Проверьте данные профиля");
        Boolean confirmPlanned = p.confirmPlannedCycle();
        if (confirmPlanned == null) confirmPlanned = profiles.findById(userId)
                .map(QuestionnaireProfile::confirmPlannedCycle).orElse(null);
        return profiles.save(new QuestionnaireProfile(userId,p.sex(),p.age(),p.trackCycle(),confirmPlanned));
    }
    static void validate(Answers a, LocalDate today, boolean trackCycle) {
        if(a==null || a.yesterday()==null || a.today()==null || a.medicationYesterday()==null || a.alcoholYesterday()==null)
            throw invalid("Ответьте на все карточки, в том числе «Не помню»");
        if(a.sleepMinutes()!=null && (a.sleepMinutes()<0 || a.sleepMinutes()>1440)
                || a.sleepQuality()!=null && (a.sleepQuality()<1 || a.sleepQuality()>5)
                || a.stress()!=null && (a.stress()<0 || a.stress()>10)) throw invalid("Проверьте сон и стресс");
        if((a.sleepMinutes()==null || a.sleepMinutes()==0) && a.sleepQuality()!=null) throw invalid("Качество сна без сна не указывается");
        if(!trackCycle && (a.menstruating()!=null || a.cycleStart()!=null || a.cycleEnded()!=null)) throw invalid("Отслеживание цикла отключено");
        if(a.menstruating()!=null && a.cycleEnded()!=null) throw invalid("Проверьте ответы о цикле");
        if(a.menstruating()==Answer.YES && !today.equals(a.cycleStart())
                || a.cycleStart()!=null && a.menstruating()!=Answer.YES) throw invalid("Проверьте начало цикла");
    }
    public Result submit(String userId, LocalDate day, String timezone, Answers a) {
        ZoneId z=zone(timezone); var now=clock.instant(); var today=now.atZone(z).toLocalDate();
        // Historical diary edits use attack forms. A completed questionnaire belongs to the actual day of attendance.
        if(!today.equals(day)) throw invalid("Наступил новый день. Откройте сегодняшний опрос заново");
        var profile=profiles.findById(userId).orElse(new QuestionnaireProfile(userId,QuestionnaireProfile.Sex.UNSPECIFIED,null,false));
        var cycleEnabled=profile.trackCycle() && profile.sex()==QuestionnaireProfile.Sex.FEMALE;
        validate(a,today,cycleEnabled);
        String id=key(userId,day); boolean created=false;
        for(int attempt=0;attempt<4;attempt++) {
            var old=entries.findById(id).orElse(null);
            if(old!=null && !old.timezone().equals(timezone)) throw invalid("Этот опрос уже начат в другом часовом поясе");
            var input=old==null ? capture(userId,day,z,a,profile) : old.prediction();
            now=clock.instant();
            if(!now.atZone(z).toLocalDate().equals(day)) throw invalid("Наступил новый день. Откройте сегодняшний опрос заново");
            if(old!=null && old.answers().equals(a)) break;
            var revisions=new ArrayList<AnswerRevision>(old==null?List.of():old.answerHistory());
            revisions.add(new AnswerRevision(now,a));
            var entry=new DailyQuestionnaire(id,userId,day,timezone,old==null?now:old.completedAt(),a,revisions,input,
                    old==null?null:old.outcome(),old!=null && old.horizonCompleted(),old==null?List.of():old.labelHistory(),old==null?null:old.version());
            try { if(old==null) { entries.insert(entry); created=true; } else entries.save(entry); break; }
            catch(DuplicateKeyException | OptimisticLockingFailureException e) { if(attempt==3) throw e; }
        }
        reconcile(userId);
        return new Result(entries.findById(id).orElseThrow(),created,streak(entries.findByUserId(userId),today));
    }
    private PredictionInput capture(String userId, LocalDate day, ZoneId z, Answers a, QuestionnaireProfile profile) {
        var user=users.findById(userId).orElseThrow();
        Map<String,Object> weather=new LinkedHashMap<>(); Integer ruleScore=null;
        // Fetch first: issuedAt is the point at which all features are actually available.
        if(user.getLatitude()!=null && user.getLongitude()!=null) try {
            var forecast=forecasts.getForecast(user.getLatitude(),user.getLongitude());
            var d=forecast.days().stream().filter(f -> day.equals(f.date())).findFirst().orElse(null);
            weather.put("provider",forecast.provider()); weather.put("fetchedAt",forecast.cachedAt()); weather.put("stale",forecast.stale());
            if(d!=null) { weather.put("pressureMmHg",d.pressureMmHg()); weather.put("pressureDelta24hMmHg",d.pressureDelta24hMmHg());
                weather.put("humidity",d.humidity()); weather.put("humidityDelta24h",d.humidityDelta24h());
                weather.put("tempMin",d.tempMin()); weather.put("tempMax",d.tempMax()); weather.put("windKmhMax",d.windKmhMax()); weather.put("kpIndex",d.kpIndex());
                ruleScore=d.score(); }
        } catch(RuntimeException ignored) { weather.put("unavailable",true); }
        var history=attacks.findInRange(userId,day.minusDays(90),day);
        var meds=medications.findInRange(userId,day.minusDays(30),day);
        Instant issue=clock.instant();
        var before=history.stream().filter(t -> t.getStartDate()!=null && t.getStartTime()!=null
                && !t.getStartDate().atTime(t.getStartTime()).atZone(z).toInstant().isAfter(issue)).toList();
        Map<String,Object> f=new LinkedHashMap<>();
        f.put("sleepMinutes",a.sleepMinutes()); f.put("sleepQuality",a.sleepQuality()); f.put("stress",a.stress());
        f.put("newStartYesterday",binary(a.yesterday())); f.put("newStartBeforeSurveyToday",binary(a.today()));
        // The ongoing card was removed. A recorded active episode is still known at issue;
        // absence of a record never means an explicit "no".
        boolean recordedOngoing=history.stream().anyMatch(t -> t.isOngoing() && t.overlaps(day)
                && (t.getStartDate().isBefore(day) || t.getStartTime()!=null
                    && !t.getStartDate().atTime(t.getStartTime()).atZone(z).toInstant().isAfter(issue)));
        f.put("ongoingAtIssue",recordedOngoing?Integer.valueOf(1):binary(a.ongoing())); f.put("medicationYesterday",binary(a.medicationYesterday()));
        f.put("alcoholYesterday",binary(a.alcoholYesterday()));
        f.put("sex",profile.sex().name()); f.put("age",profile.age());
        var cycle = profile.sex() == QuestionnaireProfile.Sex.FEMALE
                ? CycleHistory.from(cycleMarkers.findByUserIdOrderByDateAsc(userId), day, issue).latest() : null;
        f.put("cycleStartedToday", cycle != null && day.equals(cycle.start()) ? Integer.valueOf(1) : binary(a.menstruating()));
        f.put("cycleEndedToday", cycle != null && day.equals(cycle.end()) && !"AUTO".equals(cycle.endSource())
                ? Integer.valueOf(1) : binary(a.cycleEnded()));
        f.put("cycleDay", cycle == null ? null : ChronoUnit.DAYS.between(cycle.start(),day)+1);
        f.put("hourLocal",issue.atZone(z).getHour()+issue.atZone(z).getMinute()/60.0);
        f.put("horizonHours",Duration.between(issue,day.plusDays(1).atStartOfDay(z).toInstant()).toSeconds()/3600.0);
        for(int n:new int[]{3,7,14,30,90}) f.put("episodeStartsLast"+n+"Days",before.stream().filter(t -> !t.getStartDate().isBefore(day.minusDays(n))).count());
        f.put("daysSinceLastAttackStart",before.stream().map(Attack::getStartDate).max(Comparator.naturalOrder()).map(d -> ChronoUnit.DAYS.between(d,day)).orElse(null));
        f.put("medicationDaysLast7Days",meds.stream().filter(m -> m.getDate()!=null && !m.getDate().isBefore(day.minusDays(7))
                && m.getTime()!=null && !m.getDate().atTime(m.getTime()).atZone(z).toInstant().isAfter(issue)).map(Medication::getDate).distinct().count());
        var p=participation.findByUserId(userId).filter(v -> v.isParticipating() && !v.isAdminBlocked()
                && SharedModelConsentPolicy.VERSION.equals(v.getConsentVersion()) && SharedModelConsentPolicy.DIGEST.equals(v.getConsentDigest())).orElse(null);
        return new PredictionInput("after-survey-local-day-v2",5,issue,day.plusDays(1).atStartOfDay(z).toInstant(),f,weather,
                p==null?null:p.getConsentVersion(),p==null?null:p.getConsentDigest(),ruleScore);
    }
    private static Integer binary(Answer a) { return a==null || a==Answer.UNKNOWN?null:a==Answer.YES?1:0; }
    public static int streak(List<DailyQuestionnaire> all, LocalDate today) {
        Set<LocalDate> dates=new HashSet<>(); all.forEach(e -> dates.add(e.date()));
        LocalDate cursor=dates.contains(today)?today:today.minusDays(1); int count=0;
        while(dates.contains(cursor)) { count++; cursor=cursor.minusDays(1); } return count;
    }
    @EventListener public void diaryChanged(DiaryChangedEvent event) {
        try { reconcile(event.userId()); }
        catch (RuntimeException failure) { org.slf4j.LoggerFactory.getLogger(getClass()).warn("Questionnaire labels pending reconciliation: {}", failure.getClass().getSimpleName()); }
    }
    @EventListener public void deleted(AccountDeletedEvent event) { entries.deleteByUserId(event.userId()); profiles.deleteById(event.userId()); }
    @Scheduled(cron="0 5 * * * *") public void finalizeHorizons() {
        entries.findAll().stream().map(DailyQuestionnaire::userId).distinct().forEach(userId -> diaryChanged(new DiaryChangedEvent(userId)));
    }
    public void reconcile(String userId) {
        var history=attacks.findByUserIdOrderByStartDateDescStartTimeDesc(userId);
        var all=entries.findByUserId(userId);
        for(var initial:all) for(int retry=0;retry<3;retry++) {
            var e=retry==0?initial:entries.findById(initial.id()).orElseThrow();
            ZoneId z=zone(e.timezone()); var input=e.prediction();
            var dayStarts=history.stream().filter(t -> e.date().equals(t.getStartDate())).toList();
            var matched=dayStarts.stream().filter(t -> t.getStartTime()!=null && !t.getStartDate().atTime(t.getStartTime()).atZone(z).toInstant().isBefore(input.issuedAt())
                    && t.getStartDate().atTime(t.getStartTime()).atZone(z).toInstant().isBefore(input.endAt())).map(Attack::getId).sorted().toList();
            boolean completed=!clock.instant().isBefore(input.endAt());
            var confirmation=all.stream().filter(n -> n.date().equals(e.date().plusDays(1))).findFirst().orElse(null);
            // A full-day NO confirms no onset after issue only if no conflicting diary entry remains.
            Integer y=!matched.isEmpty()?Integer.valueOf(1):completed && dayStarts.isEmpty() && confirmation!=null
                    && confirmation.answers().yesterday()==Answer.NO?Integer.valueOf(0):null;
            if(Objects.equals(y,e.outcome()) && completed==e.horizonCompleted()) break;
            var revisions=new ArrayList<>(e.labelHistory()); revisions.add(new LabelRevision(clock.instant(),y,completed,matched));
            try { entries.save(new DailyQuestionnaire(e.id(),e.userId(),e.date(),e.timezone(),e.completedAt(),e.answers(),e.answerHistory(),input,y,completed,revisions,e.version())); break; }
            catch(OptimisticLockingFailureException conflict) { if(retry==2) throw conflict; }
        }
    }
}
