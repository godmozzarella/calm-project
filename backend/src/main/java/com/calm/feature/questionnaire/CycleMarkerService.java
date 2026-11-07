package com.calm.feature.questionnaire;

import com.calm.feature.risk.AccountDeletedEvent;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

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

    public record Marker(LocalDate date, CycleMarker.Kind kind) {}

    public List<Marker> list(String userId) {
        var all=markers.findByUserIdOrderByDateAsc(userId);
        var result=new ArrayList<Marker>();
        knownDays(all, Instant.MAX).keySet().stream().sorted().forEach(day -> result.add(new Marker(day, CycleMarker.Kind.DAY)));
        all.stream().filter(m -> m.kind()==CycleMarker.Kind.CLOSED).forEach(m -> result.add(new Marker(m.date(),m.kind())));
        return result;
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
            if (marker.kind()==CycleMarker.Kind.CLOSED) continue;
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

    static List<LocalDate> starts(Map<LocalDate, Instant> days) {
        return days.keySet().stream().sorted().filter(day -> !days.containsKey(day.minusDays(1))).toList();
    }

    static LocalDate activeStart(LocalDate day, List<CycleMarker> all, Map<LocalDate,Instant> selected) {
        var lastEnd=all.stream().filter(m -> (m.kind()==CycleMarker.Kind.CLOSED || m.kind()==CycleMarker.Kind.END)
                && !m.date().isAfter(day)).map(CycleMarker::date).max(Comparator.naturalOrder()).orElse(null);
        var candidates=starts(selected).stream().filter(d -> !d.isAfter(day) && (lastEnd==null || d.isAfter(lastEnd))).toList();
        // A missed checkbox can leave a gap inside one period. Keep its first recent day as the start.
        return candidates.stream().filter(d -> !d.isBefore(day.minusDays(14))).min(Comparator.naturalOrder())
                .orElseGet(() -> candidates.stream().max(Comparator.naturalOrder()).orElse(null));
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

    public Marker put(String userId, LocalDate date, CycleMarker.Kind kind, String timezone) {
        validate(userId, date, timezone);
        if (kind!=CycleMarker.Kind.DAY && kind!=CycleMarker.Kind.CLOSED) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Выберите день менструации");
        materializeLegacy(userId);
        if (kind==CycleMarker.Kind.CLOSED) {
            var today=clock.instant().atZone(ZoneId.of(timezone)).toLocalDate();
            var all=markers.findByUserIdOrderByDateAsc(userId);
            var selected=knownDays(all,Instant.MAX);
            if (date.isAfter(today) || !selected.containsKey(date) || activeStart(date,all,selected)==null)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Выберите отмеченный прошедший день цикла");
        }
        var id = CycleMarker.key(userId, date, kind);
        markers.findById(id).orElseGet(() -> markers.save(new CycleMarker(id, userId, date, kind, clock.instant(),"CALENDAR")));
        return new Marker(date, kind);
    }

    public void remove(String userId, LocalDate date, CycleMarker.Kind kind, String timezone) {
        validate(userId, date, timezone);
        if (kind!=CycleMarker.Kind.DAY && kind!=CycleMarker.Kind.CLOSED) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Выберите день менструации");
        materializeLegacy(userId);
        markers.deleteById(CycleMarker.key(userId, date, kind));
        if (kind==CycleMarker.Kind.DAY) markers.deleteById(CycleMarker.key(userId,date,CycleMarker.Kind.CLOSED));
    }

    @EventListener public void deleted(AccountDeletedEvent event) { markers.deleteByUserId(event.userId()); }
}
