package com.calm.feature.questionnaire;

import com.calm.feature.risk.AccountDeletedEvent;
import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static com.calm.feature.questionnaire.CycleMarker.Kind.*;

@Service
public class CyclePromptService {
    enum Type { INITIAL, START, LATE_START, END, PLANNED_START, SHORT_INTERVAL, AUTO_CLOSED }
    enum Choice { YES, EARLIER, NO, SKIP, SNOOZE, DISABLE, SHIFT, MERGE, SEPARATE, FIX_END, ACKNOWLEDGE }
    public record Question(Type type, LocalDate today, LocalDate start, LocalDate end, LocalDate related) {}
    public record Answer(Question question, Choice choice, LocalDate date, Integer days) {}
    public record Overview(String state, List<CycleHistory.Period> history, CycleHistory.Statistics statistics) {}

    private final CycleMarkerService calendar;
    private final QuestionnaireProfileRepository profiles;
    private final CycleQuestionStateRepository states;
    private final UserRepository users;
    private final Clock clock;

    @Autowired
    public CyclePromptService(CycleMarkerService calendar, QuestionnaireProfileRepository profiles,
            CycleQuestionStateRepository states, UserRepository users) {
        this(calendar, profiles, states, users, Clock.systemUTC());
    }

    CyclePromptService(CycleMarkerService calendar, QuestionnaireProfileRepository profiles,
            CycleQuestionStateRepository states, UserRepository users, Clock clock) {
        this.calendar = calendar;
        this.profiles = profiles;
        this.states = states;
        this.users = users;
        this.clock = clock;
    }

    public Overview overview(String userId, String timezone) {
        var today = today(timezone);
        var timeline = calendar.history(userId, today);
        var latest = timeline.latest();
        String state = latest == null ? "NO_HISTORY" : latest.end() == null ? "ONGOING" : "WAITING";
        return new Overview(state, timeline.periods(), timeline.statistics());
    }

    public synchronized Question claim(String userId, String timezone) {
        var today = today(timezone);
        var profile = profiles.findById(userId).orElse(null);
        if (!enabled(profile)) return null;
        var state = states.findById(userId).orElseGet(() -> CycleQuestionState.empty(userId, timezone));
        var timeline = calendar.closeOverdue(userId, today);
        if (state.lastShown() != null && !today.isAfter(state.lastShown())
                || state.snoozedUntil() != null && today.isBefore(state.snoozedUntil())) return null;
        int missed = state.ignored() + (state.lastShown() != null && !state.lastShown().equals(state.answeredOn()) ? 1 : 0);
        var question = next(userId, today, profile, state, missed, timeline);
        if (question != null) states.save(state.shown(question, timezone, missed));
        return question;
    }

    private Question next(String userId, LocalDate today, QuestionnaireProfile profile, CycleQuestionState state,
            int ignored, CycleHistory.Timeline timeline) {
        var latest = timeline.latest();
        var stats = timeline.statistics();
        var plan = timeline.periods().stream().filter(period -> period.planned() && !period.start().isBefore(today))
                .findFirst().orElse(null);
        if (plan != null && today.equals(plan.start()) && profile.confirmsPlans() && (latest == null || latest.end() != null)) {
            return new Question(Type.PLANNED_START, today, plan.start(), null, null);
        }
        if (latest != null && "AUTO".equals(latest.endSource()) && !Objects.equals(latest.end(), state.acknowledgedAutoEnd())) {
            return new Question(Type.AUTO_CLOSED, today, latest.start(), latest.end(), null);
        }
        int multiplier = ignored >= 3 ? 2 : 1;
        var previous = previous(timeline);
        if (previous != null && ChronoUnit.DAYS.between(previous.start(), latest.start()) < 15
                && !calendar.has(userId, latest.start(), SEPARATE) && due(state, today, multiplier)) {
            return new Question(Type.SHORT_INTERVAL, today, latest.start(), latest.end(), previous.start());
        }
        if (latest == null) {
            return plan == null && !state.initialShown() ? new Question(Type.INITIAL, today, null, null, null) : null;
        }
        long day = ChronoUnit.DAYS.between(latest.start(), today) + 1;
        if (latest.end() == null) {
            long firstEndDay = Math.max(3, Math.round(stats.periodLength() - 1));
            return day >= firstEndDay && due(state, today, multiplier)
                    ? new Question(Type.END, today, latest.start(), null, null) : null;
        }
        if (plan != null) return null;
        long windowStart = Math.max(21, (long) Math.ceil(stats.cycleLength() - stats.spread() / 2.0 - 3));
        if (day < windowStart) return null;
        int cadence = day <= stats.cycleLength() + 3 ? ("LOW".equals(stats.confidence()) ? 2 : 1)
                : day <= 45 ? 2 : 3;
        Type type = day > 45 && day > stats.cycleLength() + 3 ? Type.LATE_START : Type.START;
        return due(state, today, cadence * multiplier) ? new Question(type, today, latest.start(), latest.end(), null) : null;
    }

    private static boolean due(CycleQuestionState state, LocalDate today, int cadence) {
        return state.lastShown() == null || !today.isBefore(state.lastShown().plusDays(cadence));
    }

    private static CycleHistory.Period previous(CycleHistory.Timeline timeline) {
        var actual = timeline.actual();
        return actual.size() < 2 ? null : actual.get(actual.size() - 2);
    }

    public synchronized void answer(String userId, String timezone, Answer response) {
        var today = today(timezone);
        var profile = profiles.findById(userId).orElse(null);
        var state = states.findById(userId).orElseThrow(CyclePromptService::stale);
        if (response == null || response.choice() == null || response.question() == null
                || !response.question().equals(state.question()) || !today.equals(state.lastShown())) throw stale();
        if (today.equals(state.answeredOn())) return;
        if (!enabled(profile)) throw stale();

        var question = response.question();
        var choice = response.choice();
        var snooze = state.snoozedUntil();
        var acknowledged = state.acknowledgedAutoEnd();
        if (choice == Choice.DISABLE) {
            profiles.save(new QuestionnaireProfile(userId, profile.sex(), profile.age(), false, profile.confirmPlannedCycle()));
        } else if (choice == Choice.SNOOZE) {
            if (!List.of(3, 7, 14).contains(response.days() == null ? 0 : response.days())) throw invalid("Выберите 3, 7 или 14 дней");
            snooze = today.plusDays(response.days());
        } else if (choice != Choice.SKIP) {
            synchronized (calendar) {
                recordAnswer(userId, response, today, calendar.history(userId, today));
            }
        }
        if (question.type() == Type.AUTO_CLOSED) acknowledged = question.end();
        states.save(state.answered(today, snooze, acknowledged, choice == Choice.SKIP));
    }

    private void recordAnswer(String userId, Answer response, LocalDate today, CycleHistory.Timeline timeline) {
        var question = response.question();
        var choice = response.choice();
        var latest = timeline.latest();
        switch (question.type()) {
            case INITIAL, START, LATE_START -> {
                if (latest != null && (!latest.start().equals(question.start()) || !Objects.equals(latest.end(), question.end()))
                        || latest == null && question.start() != null) throw stale();
                if (choice == Choice.YES || choice == Choice.EARLIER) {
                    var date = choice == Choice.YES ? today : pastDate(response.date(), today);
                    calendar.recordStart(userId, date, "CARD");
                } else if (choice != Choice.NO) throw invalid("Выберите ответ о начале месячных");
            }
            case END -> {
                if (latest == null || !latest.start().equals(question.start()) || latest.end() != null) throw stale();
                if (choice == Choice.YES || choice == Choice.EARLIER) {
                    calendar.recordEnd(userId, latest.start(), choice == Choice.YES ? today : pastDate(response.date(), today), "CARD");
                } else if (choice != Choice.NO) throw invalid("Выберите ответ об окончании месячных");
            }
            case PLANNED_START -> {
                if (!calendar.has(userId, question.start(), PLANNED)) throw stale();
                if (choice == Choice.YES) calendar.recordStart(userId, today, "CARD");
                else if (choice == Choice.NO) calendar.movePlan(userId, question.start(), null);
                else if (choice == Choice.SHIFT && response.date() != null && response.date().isAfter(today)) {
                    calendar.movePlan(userId, question.start(), response.date());
                } else throw invalid("Выберите будущую дату");
            }
            case SHORT_INTERVAL -> {
                var previous = previous(timeline);
                if (latest == null || previous == null || !latest.start().equals(question.start())
                        || !previous.start().equals(question.related())) throw stale();
                if (choice == Choice.MERGE) calendar.merge(userId, previous, latest);
                else if (choice == Choice.SEPARATE) calendar.separate(userId, latest.start());
                else throw invalid("Уточните, к какому циклу относится отметка");
            }
            case AUTO_CLOSED -> {
                if (latest == null || !latest.start().equals(question.start()) || !Objects.equals(latest.end(), question.end())) throw stale();
                if (choice == Choice.FIX_END) calendar.correctAutoEnd(userId, latest, pastDate(response.date(), today));
                else if (choice != Choice.ACKNOWLEDGE) throw invalid("Выберите ответ об окончании месячных");
            }
        }
    }

    @Scheduled(cron = "0 10 * * * *")
    public synchronized void closeOverduePeriods() {
        for (var profile : profiles.findByTrackCycleTrue()) {
            if (!enabled(profile)) continue;
            try {
                var timezone = states.findById(profile.id()).map(CycleQuestionState::timezone)
                        .orElseGet(() -> users.findById(profile.id()).map(User::getLocationTimezone).orElse("UTC"));
                var today = today(timezone);
                calendar.closeOverdue(profile.id(), today);
            } catch (RuntimeException failure) {
                LoggerFactory.getLogger(getClass()).warn("Cycle calendar update failed: {}", failure.getClass().getSimpleName());
            }
        }
    }

    @EventListener public void deleted(AccountDeletedEvent event) { states.deleteById(event.userId()); }

    private static boolean enabled(QuestionnaireProfile profile) {
        return profile != null && profile.sex() == QuestionnaireProfile.Sex.FEMALE && profile.trackCycle();
    }

    private LocalDate today(String timezone) {
        try { return clock.instant().atZone(ZoneId.of(timezone)).toLocalDate(); }
        catch (RuntimeException failure) { throw invalid("Проверьте часовой пояс"); }
    }

    private static LocalDate pastDate(LocalDate date, LocalDate today) {
        if (date == null || date.isAfter(today)) throw invalid("Выберите сегодняшнюю или прошедшую дату");
        return date;
    }

    private static ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private static ResponseStatusException stale() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "Календарь изменился. Продолжите опрос или проверьте отметки в календаре.");
    }
}
