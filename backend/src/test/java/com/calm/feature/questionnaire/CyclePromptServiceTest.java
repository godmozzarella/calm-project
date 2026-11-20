package com.calm.feature.questionnaire;

import com.calm.feature.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static com.calm.feature.questionnaire.CyclePromptService.Choice.*;
import static com.calm.feature.questionnaire.CyclePromptService.Type.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class CyclePromptServiceTest {
    private static final String USER = "alice";
    private static final String ZONE = "Europe/Moscow";
    private static final LocalDate START_DAY = LocalDate.of(2026, 1, 1);
    private final CycleMarkerRepository markers = mock(CycleMarkerRepository.class);
    private final CycleQuestionStateRepository states = mock(CycleQuestionStateRepository.class);
    private final QuestionnaireProfileRepository profiles = mock(QuestionnaireProfileRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final HashMap<String, CycleMarker> calendarEntries = new HashMap<>();
    private final HashMap<String, CycleQuestionState> questionEntries = new HashMap<>();
    private final MutableClock clock = new MutableClock();
    private final CycleMarkerService calendar = new CycleMarkerService(markers, profiles, clock);
    private final CyclePromptService prompts = new CyclePromptService(calendar, profiles, states, users, clock);
    private QuestionnaireProfile profile = new QuestionnaireProfile(USER, QuestionnaireProfile.Sex.FEMALE, null, true);

    @BeforeEach void setup() {
        jump(START_DAY);
        when(profiles.findById(USER)).thenAnswer(call -> Optional.of(profile));
        when(profiles.save(any(QuestionnaireProfile.class))).thenAnswer(call -> profile = call.getArgument(0));
        when(markers.findByUserIdOrderByDateAsc(USER)).thenAnswer(call -> calendarEntries.values().stream().toList());
        when(markers.findById(anyString())).thenAnswer(call -> Optional.ofNullable(calendarEntries.get(call.getArgument(0))));
        when(markers.save(any(CycleMarker.class))).thenAnswer(call -> {
            CycleMarker marker = call.getArgument(0);
            calendarEntries.put(marker.id(), marker);
            return marker;
        });
        doAnswer(call -> { calendarEntries.remove(call.getArgument(0)); return null; }).when(markers).deleteById(anyString());
        when(states.findById(USER)).thenAnswer(call -> Optional.ofNullable(questionEntries.get(USER)));
        when(states.save(any(CycleQuestionState.class))).thenAnswer(call -> {
            CycleQuestionState state = call.getArgument(0);
            questionEntries.put(state.id(), state);
            return state;
        });
    }

    @Test void firstQuestionIsShownOnceEvenAfterRestartAndEarlierDateRecordsStart() {
        var question = claim(INITIAL);
        assertThat(prompts.claim(USER, ZONE)).isNull();
        reply(question, EARLIER, START_DAY.minusDays(1));
        var restarted = new CyclePromptService(calendar, profiles, states, users, clock);
        assertThat(restarted.claim(USER, ZONE)).isNull();
        assertThat(prompts.overview(USER, ZONE).history()).singleElement().satisfies(period -> {
            assertThat(period.start()).isEqualTo(START_DAY.minusDays(1));
            assertThat(period.startSource()).isEqualTo("CARD");
        });
    }

    @Test void unansweredInitialQuestionDoesNotReturnEveryDay() {
        claim(INITIAL);
        jump(START_DAY.plusDays(1));
        assertThat(prompts.claim(USER, ZONE)).isNull();
    }

    @Test void endPromptsStartOnDayFourAndAnEarlierEndUpdatesCalendar() {
        calendar.recordStart(USER, START_DAY, "CALENDAR");
        jump(START_DAY.plusDays(2));
        assertThat(prompts.claim(USER, ZONE)).isNull();
        jump(START_DAY.plusDays(3));
        reply(claim(END), NO, null);
        assertThat(prompts.claim(USER, ZONE)).isNull();
        jump(START_DAY.plusDays(4));
        reply(claim(END), EARLIER, START_DAY.plusDays(3));
        assertThat(prompts.overview(USER, ZONE).state()).isEqualTo("WAITING");
        assertThat(prompts.overview(USER, ZONE).statistics().periodLength()).isEqualTo(4);
        jump(START_DAY.plusDays(5));
        assertThat(prompts.claim(USER, ZONE)).isNull();
    }

    @Test void markingOnlyAStartFourDaysAgoMakesTheEndQuestionDueEvenOnAPlannedDay() {
        var planned = START_DAY.plusDays(4);
        calendar.range(USER, planned, planned, ZONE);
        jump(planned);
        calendar.range(USER, START_DAY, START_DAY, ZONE);
        assertThat(prompts.overview(USER, ZONE).state()).isEqualTo("ONGOING");
        assertThat(claim(END).start()).isEqualTo(START_DAY);
        assertThat(prompts.claim(USER, ZONE)).isNull();
    }

    @Test void calendarChangesKeepTheOneQuestionPerDayLimit() {
        jump(START_DAY.plusDays(4));
        reply(claim(INITIAL), NO, null);
        calendar.range(USER, START_DAY, START_DAY, ZONE);
        assertThat(prompts.claim(USER, ZONE)).isNull();
        jump(START_DAY.plusDays(5));
        claim(END);
    }

    @Test void tenDayAutoCloseShowsOnceAndCanBeCorrectedWithoutLeavingInferredDays() {
        calendar.recordStart(USER, START_DAY, "CALENDAR");
        jump(START_DAY.plusDays(9));
        var question = claim(AUTO_CLOSED);
        assertThat(question.end()).isEqualTo(START_DAY.plusDays(4));
        assertThat(prompts.overview(USER, ZONE).history().getFirst().endSource()).isEqualTo("AUTO");
        reply(question, FIX_END, START_DAY.plusDays(2));
        assertThat(prompts.overview(USER, ZONE).history().getFirst().end()).isEqualTo(START_DAY.plusDays(2));
        assertThat(calendar.list(USER)).noneMatch(marker -> marker.date().isAfter(START_DAY.plusDays(2)));
        jump(START_DAY.plusDays(10));
        assertThat(prompts.claim(USER, ZONE)).isNull();
    }

    @Test void deletingAutomaticClosureReopensWithoutImmediatelyAutoClosingAgain() {
        calendar.recordStart(USER, START_DAY, "CALENDAR");
        jump(START_DAY.plusDays(9));
        var question = claim(AUTO_CLOSED);
        calendar.remove(USER, question.end(), CycleMarker.Kind.CLOSED, ZONE);
        jump(START_DAY.plusDays(10));
        claim(END);
        assertThat(prompts.overview(USER, ZONE).state()).isEqualTo("ONGOING");
    }

    @Test void deletingTheAutomaticallyMarkedLastDayAlsoReopensThePeriod() {
        calendar.recordStart(USER, START_DAY, "CALENDAR");
        jump(START_DAY.plusDays(9));
        var question = claim(AUTO_CLOSED);
        calendar.remove(USER, question.end(), CycleMarker.Kind.DAY, ZONE);
        jump(START_DAY.plusDays(10));
        claim(END);
        assertThat(calendar.list(USER)).noneMatch(marker -> marker.date().equals(question.end()));
    }

    @Test void medianFromHistoryMovesQuestionsForLongerCyclesAndDeletesRecalculateIt() {
        jump(START_DAY.plusDays(50));
        closedPeriod(START_DAY);
        closedPeriod(START_DAY.plusDays(38));
        assertThat(prompts.overview(USER, ZONE).statistics().cycleLength()).isEqualTo(38);
        jump(START_DAY.plusDays(68));
        assertThat(prompts.claim(USER, ZONE)).isNull();
        jump(START_DAY.plusDays(72));
        claim(START);
        for (int offset = 38; offset <= 42; offset++) {
            calendar.remove(USER, START_DAY.plusDays(offset), CycleMarker.Kind.DAY, ZONE);
        }
        assertThat(prompts.overview(USER, ZONE).statistics().cycleLength()).isEqualTo(28);
    }

    @Test void shortIntervalCanBeMergedAndDoesNotDistortStatistics() {
        jump(START_DAY.plusDays(11));
        closedPeriod(START_DAY);
        calendar.recordStart(USER, START_DAY.plusDays(8), "CALENDAR");
        assertThat(prompts.overview(USER, ZONE).statistics().validIntervals()).isZero();
        reply(claim(SHORT_INTERVAL), MERGE, null);
        assertThat(prompts.overview(USER, ZONE).history()).singleElement()
                .satisfies(period -> assertThat(period.start()).isEqualTo(START_DAY));
    }

    @Test void statisticsUseTheLastSixValidIntervalsAndExcludePlans() {
        jump(START_DAY.plusDays(400));
        var start = START_DAY;
        closedPeriod(start);
        for (int interval : new int[]{18, 29, 35, 32, 10, 37, 42, 95, 40}) {
            start = start.plusDays(interval);
            closedPeriod(start);
        }
        calendar.range(USER, START_DAY.plusDays(450), START_DAY.plusDays(450), ZONE);
        var statistics = prompts.overview(USER, ZONE).statistics();
        assertThat(statistics.cycleLength()).isEqualTo(36);
        assertThat(statistics.spread()).isEqualTo(13);
        assertThat(statistics.periodLength()).isEqualTo(5);
        assertThat(statistics.validIntervals()).isEqualTo(7);
        assertThat(statistics.confidence()).isEqualTo("HIGH");
    }

    @Test void futurePlanSuppressesQuestionsAndCanBeMovedOrDeclined() {
        jump(START_DAY.plusDays(15));
        closedPeriod(START_DAY);
        var planned = START_DAY.plusDays(30);
        calendar.range(USER, planned, planned.plusDays(4), ZONE);
        assertThat(calendar.list(USER)).contains(new CycleMarkerService.Marker(planned, CycleMarker.Kind.PLANNED, planned.plusDays(4)));
        assertThat(prompts.overview(USER, ZONE).statistics().validIntervals()).isZero();
        jump(START_DAY.plusDays(25));
        assertThat(prompts.claim(USER, ZONE)).isNull();
        jump(planned);
        var shifted = planned.plusDays(3);
        reply(claim(PLANNED_START), SHIFT, shifted);
        assertThat(prompts.overview(USER, ZONE).history().stream().filter(CycleHistory.Period::planned))
                .singleElement().satisfies(period -> {
                    assertThat(period.start()).isEqualTo(shifted);
                    assertThat(period.end()).isEqualTo(shifted.plusDays(4));
                });
        jump(shifted);
        reply(claim(PLANNED_START), NO, null);
        assertThat(prompts.overview(USER, ZONE).history()).noneMatch(CycleHistory.Period::planned);
        assertThat(prompts.claim(USER, ZONE)).isNull();
    }

    @Test void plannedConfirmationCanBeDisabledWithoutDiscardingPlan() {
        profile = new QuestionnaireProfile(USER, QuestionnaireProfile.Sex.FEMALE, null, true, false);
        var planned = START_DAY.plusDays(1);
        calendar.range(USER, planned, planned, ZONE);
        jump(planned);
        assertThat(prompts.claim(USER, ZONE)).isNull();
        assertThat(prompts.overview(USER, ZONE).history()).singleElement().matches(CycleHistory.Period::planned);
    }

    @Test void oldFutureCalendarDayIsKeptAsAPlanUntilConfirmed() {
        var planned = START_DAY.plusDays(10);
        var oldId = CycleMarker.key(USER, planned, CycleMarker.Kind.DAY);
        calendarEntries.put(oldId, new CycleMarker(oldId, USER, planned, CycleMarker.Kind.DAY, clock.instant(), "CALENDAR"));
        jump(planned);
        assertThat(prompts.overview(USER, ZONE).history()).singleElement().matches(CycleHistory.Period::planned);
        reply(claim(PLANNED_START), YES, null);
        assertThat(prompts.overview(USER, ZONE).history()).singleElement().satisfies(period -> {
            assertThat(period.planned()).isFalse();
            assertThat(period.start()).isEqualTo(planned);
        });
    }

    @Test void ignoredPromptsDoubleCadenceAndSnoozePersists() {
        jump(START_DAY.plusDays(20));
        closedPeriod(START_DAY);
        for (int offset : new int[]{21, 23, 25}) {
            jump(START_DAY.plusDays(offset));
            claim(START);
        }
        jump(START_DAY.plusDays(27));
        assertThat(prompts.claim(USER, ZONE)).isNull();
        jump(START_DAY.plusDays(29));
        var question = claim(START);
        prompts.answer(USER, ZONE, new CyclePromptService.Answer(question, SNOOZE, null, 7));
        jump(START_DAY.plusDays(34));
        assertThat(prompts.claim(USER, ZONE)).isNull();
        jump(START_DAY.plusDays(36));
        claim(START);
    }

    @Test void disablingQuestionsKeepsCalendarAndProfileCanTurnThemOnAgain() {
        jump(START_DAY.plusDays(47));
        closedPeriod(START_DAY);
        reply(claim(LATE_START), DISABLE, null);
        jump(START_DAY.plusDays(52));
        assertThat(prompts.claim(USER, ZONE)).isNull();
        assertThat(prompts.overview(USER, ZONE).history()).hasSize(1);
        profile = new QuestionnaireProfile(USER, QuestionnaireProfile.Sex.FEMALE, null, true);
        claim(LATE_START);
    }

    @Test void periodCanStartInThePastAndHaveAPlannedFutureEnd() {
        jump(START_DAY.plusDays(2));
        calendar.range(USER, START_DAY, START_DAY.plusDays(5), ZONE);
        assertThat(prompts.overview(USER, ZONE).state()).isEqualTo("ONGOING");
        assertThat(calendar.list(USER)).contains(new CycleMarkerService.Marker(START_DAY, CycleMarker.Kind.PLANNED, START_DAY.plusDays(5)));
        assertThat(calendar.list(USER)).filteredOn(marker -> marker.kind() == CycleMarker.Kind.DAY).hasSize(3);
        assertThat(calendar.list(USER)).noneMatch(marker -> marker.kind() == CycleMarker.Kind.CLOSED);
        jump(START_DAY.plusDays(3));
        reply(claim(END), YES, null);
        assertThat(prompts.overview(USER, ZONE).state()).isEqualTo("WAITING");
        assertThat(calendar.list(USER)).noneMatch(marker -> marker.kind() == CycleMarker.Kind.PLANNED);
    }

    @Test void periodCanStartTodayAndHaveAPlannedFutureEnd() {
        calendar.range(USER, START_DAY, START_DAY.plusDays(4), ZONE);
        assertThat(prompts.overview(USER, ZONE).state()).isEqualTo("ONGOING");
        assertThat(calendar.list(USER)).contains(new CycleMarkerService.Marker(START_DAY, CycleMarker.Kind.DAY));
        assertThat(calendar.list(USER)).contains(new CycleMarkerService.Marker(START_DAY, CycleMarker.Kind.PLANNED, START_DAY.plusDays(4)));
    }

    private void closedPeriod(LocalDate date) { calendar.range(USER, date, date.plusDays(4), ZONE); }
    private void reply(CyclePromptService.Question question, CyclePromptService.Choice choice, LocalDate date) {
        prompts.answer(USER, ZONE, new CyclePromptService.Answer(question, choice, date, null));
    }
    private CyclePromptService.Question claim(CyclePromptService.Type type) {
        var question = prompts.claim(USER, ZONE);
        assertThat(question).isNotNull();
        assertThat(question.type()).isEqualTo(type);
        return question;
    }
    private void jump(LocalDate date) { clock.instant = date.atTime(12, 0).toInstant(ZoneOffset.UTC); }

    private static final class MutableClock extends Clock {
        private Instant instant;
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return Clock.fixed(instant, zone); }
        @Override public Instant instant() { return instant; }
    }
}
