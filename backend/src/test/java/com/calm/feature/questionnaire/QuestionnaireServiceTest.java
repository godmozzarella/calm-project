package com.calm.feature.questionnaire;

import com.calm.feature.attack.*;
import com.calm.feature.medication.*;
import com.calm.feature.user.*;
import com.calm.feature.forecast.ForecastService;
import com.calm.feature.risk.SharedModelParticipationRepository;
import org.junit.jupiter.api.*;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static com.calm.feature.questionnaire.DailyQuestionnaire.*;

class QuestionnaireServiceTest {
    QuestionnaireRepository repo=mock(QuestionnaireRepository.class);
    QuestionnaireProfileRepository profiles=mock(QuestionnaireProfileRepository.class);
    CycleMarkerRepository cycleMarkers=mock(CycleMarkerRepository.class);
    AttackRepository attacks=mock(AttackRepository.class);
    MedicationRepository meds=mock(MedicationRepository.class);
    UserRepository users=mock(UserRepository.class);
    SharedModelParticipationRepository consent=mock(SharedModelParticipationRepository.class);
    ForecastService weather=mock(ForecastService.class);
    Map<String,DailyQuestionnaire> saved=new HashMap<>();
    Map<String,CycleMarker> cycleSaved=new HashMap<>();
    List<Attack> diary=new ArrayList<>();
    MutableClock clock=new MutableClock();
    QuestionnaireService service;
    static final LocalDate DAY=LocalDate.of(2026,11,3);
    @BeforeEach void setup() {
        clock.now=Instant.parse("2026-11-03T09:00:00Z");
        when(repo.findById(anyString())).thenAnswer(i->Optional.ofNullable(saved.get(i.getArgument(0))));
        when(repo.findByUserId("u")).thenAnswer(i->new ArrayList<>(saved.values()));
        when(repo.insert(any(DailyQuestionnaire.class))).thenAnswer(i->{DailyQuestionnaire e=i.getArgument(0);saved.put(e.id(),e);return e;});
        when(repo.save(any(DailyQuestionnaire.class))).thenAnswer(i->{DailyQuestionnaire e=i.getArgument(0);saved.put(e.id(),e);return e;});
        when(attacks.findByUserIdOrderByStartDateDescStartTimeDesc("u")).thenAnswer(i->diary);
        when(attacks.findInRange(eq("u"),any(),any())).thenAnswer(i->diary);
        when(profiles.findById("u")).thenReturn(Optional.of(new QuestionnaireProfile("u",QuestionnaireProfile.Sex.UNSPECIFIED,null,false)));
        when(cycleMarkers.findByUserIdOrderByDateAsc("u")).thenAnswer(i->new ArrayList<>(cycleSaved.values()));
        when(cycleMarkers.findById(anyString())).thenAnswer(i->Optional.ofNullable(cycleSaved.get(i.getArgument(0))));
        when(cycleMarkers.save(any(CycleMarker.class))).thenAnswer(i->{CycleMarker marker=i.getArgument(0);cycleSaved.put(marker.id(),marker);return marker;});
        doAnswer(i->{cycleSaved.remove(i.getArgument(0));return null;}).when(cycleMarkers).deleteById(anyString());
        when(users.findById("u")).thenReturn(Optional.of(new User()));
        service=new QuestionnaireService(repo,profiles,cycleMarkers,attacks,meds,users,weather,consent,clock);
    }
    Answers answers(Answer yesterday) { return new Answers(yesterday,Answer.NO,Answer.NO,480,4,0,Answer.UNKNOWN,null,null,null,Answer.YES); }
    @Test void removedOngoingCardIsOptionalAndRecordedOngoingAttackStillInformsSnapshot() {
        var ongoing=new Attack();ongoing.setId("known-ongoing");ongoing.setStartDate(DAY.minusDays(1));
        ongoing.setStartTime(LocalTime.of(8,0));ongoing.setOngoing(true);diary.add(ongoing);
        var withoutHiddenAnswer=new Answers(Answer.NO,Answer.NO,null,480,4,0,Answer.NO,null,null,null,Answer.UNKNOWN);
        var entry=service.submit("u",DAY,"Europe/Moscow",withoutHiddenAnswer).entry();
        assertThat(entry.prediction().features()).containsEntry("ongoingAtIssue",1);
        assertThat(entry.answers().ongoing()).isNull();
    }
    @Test void oldOngoingAttackWithoutStartTimeStillInformsSnapshot() {
        var ongoing=new Attack();ongoing.setId("old-ongoing");ongoing.setStartDate(DAY.minusYears(1));
        ongoing.setOngoing(true);diary.add(ongoing);
        var withoutHiddenAnswer=new Answers(Answer.NO,Answer.NO,null,480,4,0,Answer.NO,null,null,null,Answer.UNKNOWN);
        assertThat(service.submit("u",DAY,"Europe/Moscow",withoutHiddenAnswer).entry().prediction().features())
                .containsEntry("ongoingAtIssue",1);
    }
    @Test void cardAnswersBecomeTypedPreIssueFeaturesForTheRemainingLocalDay() {
        when(profiles.findById("u")).thenReturn(Optional.of(new QuestionnaireProfile("u",QuestionnaireProfile.Sex.FEMALE,29,false)));
        var answer=new Answers(Answer.NO,Answer.YES,null,455,4,0,Answer.YES,null,null,null,Answer.NO);
        var input=service.submit("u",DAY,"Europe/Moscow",answer).entry().prediction();
        assertThat(input.protocol()).isEqualTo("after-survey-local-day-v2");
        assertThat(input.schemaVersion()).isEqualTo(5);
        assertThat(input.issuedAt()).isEqualTo(Instant.parse("2026-11-03T09:00:00Z"));
        assertThat(input.endAt()).isEqualTo(Instant.parse("2026-11-03T21:00:00Z"));
        assertThat(input.features()).containsEntry("sleepMinutes",455).containsEntry("sleepQuality",4)
                .containsEntry("stress",0).containsEntry("newStartYesterday",0)
                .containsEntry("newStartBeforeSurveyToday",1).containsEntry("medicationYesterday",1)
                .containsEntry("alcoholYesterday",0).containsEntry("ongoingAtIssue",null)
                .containsEntry("sex","FEMALE").containsEntry("age",29)
                .containsEntry("hourLocal",12.0).containsEntry("horizonHours",12.0);
    }
    @Test void personalProfileIsOptionalAndDefaultsNeverInventAgeOrCycle() {
        when(profiles.findById("u")).thenReturn(Optional.empty());
        var result=service.submit("u",DAY,"Europe/Moscow",answers(Answer.NO));
        assertThat(result.newCompletion()).isTrue();
        assertThat(result.entry().prediction().features()).containsEntry("sex","UNSPECIFIED").containsEntry("age",null).containsEntry("cycleStartedToday",null);
        verify(profiles,never()).save(any());
    }
    @Test void retryAndEditsNeverAwardAnotherDayOrRewriteFeatures() {
        var first=service.submit("u",DAY,"Europe/Moscow",answers(Answer.NO));
        assertThat(first.newCompletion()).isTrue(); assertThat(first.currentStreak()).isEqualTo(1);
        var retry=service.submit("u",DAY,"Europe/Moscow",answers(Answer.NO));
        assertThat(retry.newCompletion()).isFalse(); assertThat(retry.entry().answerHistory()).hasSize(1);
        var changed=service.submit("u",DAY,"Europe/Moscow",answers(Answer.YES));
        assertThat(changed.entry().prediction()).isEqualTo(first.entry().prediction());
        assertThat(changed.entry().answerHistory()).hasSize(2);
        assertThat(changed.currentStreak()).isEqualTo(1);
        assertThat(changed.entry().prediction().features()).containsEntry("stress",0).containsEntry("newStartYesterday",0).containsEntry("alcoholYesterday",1);
        verify(repo,times(1)).insert(any(DailyQuestionnaire.class));
    }
    @Test void delayedDiaryCorrectionsReviseTargetButPreserveRawNoAndFrozenX() {
        var original=service.submit("u",DAY,"Europe/Moscow",answers(Answer.NO)).entry();
        assertThat(original.outcome()).isNull();
        clock.now=Instant.parse("2026-11-04T09:00:00Z");
        service.submit("u",DAY.plusDays(1),"Europe/Moscow",answers(Answer.NO));
        assertThat(saved.get(original.id()).outcome()).isZero();
        Attack a=new Attack();a.setId("late");a.setStartDate(DAY);a.setStartTime(LocalTime.of(15,0)); diary.add(a);
        service.reconcile("u"); assertThat(saved.get(original.id()).outcome()).isEqualTo(1);
        assertThat(saved.get(original.id()).prediction()).isEqualTo(original.prediction());
        diary.clear();service.reconcile("u");assertThat(saved.get(original.id()).outcome()).isZero();
        assertThat(saved.get(key("u",DAY.plusDays(1))).answers().yesterday()).isEqualTo(Answer.NO);
        assertThat(service.status("u","Europe/Moscow").currentStreak()).isEqualTo(2);
    }
    @Test void morningStartAndContinuationAreNotFuturePositiveAndUnknownNeverBecomesZero() {
        Attack before=new Attack();before.setId("before");before.setStartDate(DAY);before.setStartTime(LocalTime.of(8,0));diary.add(before);
        service.submit("u",DAY,"Europe/Moscow",answers(Answer.NO));
        clock.now=Instant.parse("2026-11-04T09:00:00Z");
        service.submit("u",DAY.plusDays(1),"Europe/Moscow",answers(Answer.UNKNOWN));
        assertThat(saved.get(key("u",DAY)).outcome()).isNull();
        before.setStartDate(DAY.minusDays(1));before.setOngoing(true);service.reconcile("u");
        assertThat(saved.get(key("u",DAY)).outcome()).isNull();
        service.submit("u",DAY.plusDays(1),"Europe/Moscow",answers(Answer.NO));
        assertThat(saved.get(key("u",DAY)).outcome()).isZero();
    }
    @Test void noSleepAndZeroStressAreValidButOutOfRangeAndBackfillAreRejected() {
        assertThatCode(()->QuestionnaireService.validate(new Answers(Answer.NO,Answer.NO,Answer.NO,0,null,0,Answer.NO,null,null),DAY,false)).doesNotThrowAnyException();
        assertThatThrownBy(()->QuestionnaireService.validate(new Answers(Answer.NO,Answer.NO,Answer.NO,0,null,0,Answer.NO,null,null,null,null),DAY,false)).hasMessageContaining("Ответьте на все карточки");
        assertThatThrownBy(()->QuestionnaireService.validate(new Answers(Answer.NO,Answer.NO,Answer.NO,0,3,0,Answer.NO,null,null),DAY,false)).hasMessageContaining("Качество сна");
        assertThatThrownBy(()->service.submit("u",DAY.minusDays(1),"Europe/Moscow",answers(Answer.NO))).hasMessageContaining("Наступил новый день");
    }
    @Test void horizonEndsAtLocalMidnightAndIncludesDstOffset() {
        clock.now=Instant.parse("2026-10-25T00:30:00Z");
        var result=service.submit("u",LocalDate.of(2026,10,25),"Europe/Berlin",answers(Answer.NO));
        assertThat(result.entry().prediction().endAt()).isEqualTo(Instant.parse("2026-10-25T23:00:00Z"));
        assertThat(result.entry().prediction().features().get("horizonHours")).isEqualTo(22.5);
    }
    @Test void calendarStartEntersOnlyNewPredictionAndNeverRewritesOldInput() {
        when(profiles.findById("u")).thenReturn(Optional.of(new QuestionnaireProfile("u",QuestionnaireProfile.Sex.FEMALE,null,true)));
        var cycleAnswers=new Answers(Answer.NO,Answer.NO,Answer.NO,480,4,0,Answer.NO,Answer.NO,null);
        var original=service.submit("u",DAY,"Europe/Moscow",cycleAnswers).entry();
        assertThat(original.prediction().features()).containsEntry("cycleDay",null);
        var marker=new CycleMarker(CycleMarker.key("u",DAY.minusDays(3),CycleMarker.Kind.START),"u",DAY.minusDays(3),CycleMarker.Kind.START,clock.now.plusSeconds(60));
        when(cycleMarkers.findByUserIdOrderByDateAsc("u")).thenReturn(List.of(marker));
        clock.now=clock.now.plusSeconds(120);
        var endNo=new Answers(Answer.NO,Answer.NO,Answer.NO,480,4,0,Answer.NO,null,null,Answer.NO);
        assertThat(service.submit("u",DAY,"Europe/Moscow",endNo).entry().prediction()).isEqualTo(original.prediction());
        clock.now=Instant.parse("2026-11-04T09:00:00Z");
        assertThat(service.submit("u",DAY.plusDays(1),"Europe/Moscow",endNo).entry().prediction().features())
                .containsEntry("cycleDay",5L);
    }
    @Test void firstDayThisMonthSuppressesQuestionAndSurveyYesMarksCalendar() {
        when(profiles.findById("u")).thenReturn(Optional.of(new QuestionnaireProfile("u",QuestionnaireProfile.Sex.FEMALE,null,true)));
        assertThat(service.status("u","Europe/Moscow").askCycle()).isTrue();
        var first=new Answers(Answer.NO,Answer.NO,Answer.NO,480,4,0,Answer.NO,Answer.YES,DAY);
        service.submit("u",DAY,"Europe/Moscow",first);
        assertThat(cycleSaved.values()).singleElement().satisfies(m -> {
            assertThat(m.kind()).isEqualTo(CycleMarker.Kind.DAY);
            assertThat(m.date()).isEqualTo(DAY);
        });
        assertThat(service.status("u","Europe/Moscow").askCycle()).isFalse();
        cycleSaved.clear();
        assertThat(service.status("u","Europe/Moscow").askCycle()).isTrue();
        cycleSaved.put(CycleMarker.key("u",DAY,CycleMarker.Kind.DAY),new CycleMarker(CycleMarker.key("u",DAY,CycleMarker.Kind.DAY),"u",DAY,CycleMarker.Kind.DAY,clock.now));
        clock.now=Instant.parse("2026-11-04T09:00:00Z");
        assertThat(service.status("u","Europe/Moscow").askCycleEnd()).isTrue();
        var withoutCard=new Answers(Answer.NO,Answer.NO,Answer.NO,480,4,0,Answer.NO,null,null,Answer.NO);
        assertThat(service.submit("u",DAY.plusDays(1),"Europe/Moscow",withoutCard).entry().prediction().features())
                .containsEntry("cycleDay",2L);
    }
    @Test void endCardRepeatsWhileDatesAreMarkedThenYesFillsCalendarAndStopsForMonth() {
        when(profiles.findById("u")).thenReturn(Optional.of(new QuestionnaireProfile("u",QuestionnaireProfile.Sex.FEMALE,null,true)));
        var start=new Answers(Answer.NO,Answer.NO,Answer.NO,480,4,0,Answer.NO,Answer.YES,DAY);
        service.submit("u",DAY,"Europe/Moscow",start);
        assertThat(service.status("u","Europe/Moscow").askCycleEnd()).isFalse();
        clock.now=Instant.parse("2026-11-04T09:00:00Z");
        assertThat(service.status("u","Europe/Moscow").askCycleEnd()).isTrue();
        assertThatThrownBy(() -> service.submit("u",DAY.plusDays(1),"Europe/Moscow",answers(Answer.NO)))
                .hasMessageContaining("закончились ли месячные");
        var endNo=new Answers(Answer.NO,Answer.NO,Answer.NO,480,4,0,Answer.NO,null,null,Answer.NO);
        service.submit("u",DAY.plusDays(1),"Europe/Moscow",endNo);
        clock.now=Instant.parse("2026-11-05T09:00:00Z");
        var yesterday=DAY.plusDays(1);
        var yesterdayId=CycleMarker.key("u",yesterday,CycleMarker.Kind.DAY);
        cycleSaved.put(yesterdayId,new CycleMarker(yesterdayId,"u",yesterday,CycleMarker.Kind.DAY,clock.now,"CALENDAR"));
        assertThat(service.status("u","Europe/Moscow").askCycleEnd()).isTrue();
        var endYes=new Answers(Answer.NO,Answer.NO,Answer.NO,480,4,0,Answer.NO,null,null,Answer.YES);
        service.submit("u",DAY.plusDays(2),"Europe/Moscow",endYes);
        assertThat(cycleSaved.values()).extracting(CycleMarker::kind)
                .contains(CycleMarker.Kind.CLOSED);
        assertThat(CycleMarkerService.knownDays(new ArrayList<>(cycleSaved.values()),clock.now).keySet())
                .contains(DAY,DAY.plusDays(1),DAY.plusDays(2));
        assertThat(service.status("u","Europe/Moscow").askCycleEnd()).isFalse();
        assertThat(service.status("u","Europe/Moscow").askCycle()).isFalse();
        clock.now=Instant.parse("2026-11-06T09:00:00Z");
        assertThat(service.status("u","Europe/Moscow").askCycleEnd()).isFalse();
        assertThat(service.status("u","Europe/Moscow").askCycle()).isTrue();
    }
    @Test void calendarClosureSuppressesEndCardAndRemovingItReopensQuestion() {
        when(profiles.findById("u")).thenReturn(Optional.of(new QuestionnaireProfile("u",QuestionnaireProfile.Sex.FEMALE,null,true)));
        var start=DAY.minusDays(2);
        var startId=CycleMarker.key("u",start,CycleMarker.Kind.DAY);
        var yesterdayId=CycleMarker.key("u",DAY.minusDays(1),CycleMarker.Kind.DAY);
        var endId=CycleMarker.key("u",DAY.minusDays(1),CycleMarker.Kind.CLOSED);
        cycleSaved.put(startId,new CycleMarker(startId,"u",start,CycleMarker.Kind.DAY,clock.now,"CARD"));
        cycleSaved.put(yesterdayId,new CycleMarker(yesterdayId,"u",DAY.minusDays(1),CycleMarker.Kind.DAY,clock.now,"CALENDAR"));
        cycleSaved.put(endId,new CycleMarker(endId,"u",DAY.minusDays(1),CycleMarker.Kind.CLOSED,clock.now));
        assertThat(service.status("u","Europe/Moscow").askCycleEnd()).isFalse();
        cycleSaved.remove(endId);
        assertThat(service.status("u","Europe/Moscow").askCycleEnd()).isTrue();
    }
    @Test void endCardRequiresMarkYesterdayOrToday() {
        when(profiles.findById("u")).thenReturn(Optional.of(new QuestionnaireProfile("u",QuestionnaireProfile.Sex.FEMALE,null,true)));
        var first=DAY.minusDays(1);
        for(var day:List.of(first,DAY)) {
            var id=CycleMarker.key("u",day,CycleMarker.Kind.DAY);
            cycleSaved.put(id,new CycleMarker(id,"u",day,CycleMarker.Kind.DAY,clock.now,"CALENDAR"));
        }
        assertThat(service.status("u","Europe/Moscow").askCycleEnd()).isTrue();
        clock.now=Instant.parse("2026-11-04T09:00:00Z");
        var status=service.status("u","Europe/Moscow");
        assertThat(status.askCycle()).isFalse();
        assertThat(status.askCycleEnd()).isTrue();
        cycleSaved.remove(CycleMarker.key("u",DAY,CycleMarker.Kind.DAY));
        assertThat(service.status("u","Europe/Moscow").askCycleEnd()).isFalse();
        assertThatCode(() -> service.submit("u",DAY.plusDays(1),"Europe/Moscow",answers(Answer.NO)))
                .doesNotThrowAnyException();
        var today=DAY.plusDays(1);
        var id=CycleMarker.key("u",today,CycleMarker.Kind.DAY);
        cycleSaved.put(id,new CycleMarker(id,"u",today,CycleMarker.Kind.DAY,clock.now,"CALENDAR"));
        assertThat(service.status("u","Europe/Moscow").askCycleEnd()).isTrue();
    }
    @Test void futureCalendarDayDoesNotHideStartQuestionOrBecomePastCycleFeature() {
        when(profiles.findById("u")).thenReturn(Optional.of(new QuestionnaireProfile("u",QuestionnaireProfile.Sex.FEMALE,null,true)));
        var future=DAY.plusDays(2);
        var id=CycleMarker.key("u",future,CycleMarker.Kind.DAY);
        cycleSaved.put(id,new CycleMarker(id,"u",future,CycleMarker.Kind.DAY,clock.now));
        assertThat(service.status("u","Europe/Moscow").askCycle()).isTrue();
        var a=new Answers(Answer.NO,Answer.NO,Answer.NO,480,4,0,Answer.NO,Answer.NO,null);
        assertThat(service.submit("u",DAY,"Europe/Moscow",a).entry().prediction().features())
                .containsEntry("cycleDay",null);
        clock.now=Instant.parse("2026-11-05T09:00:00Z");
        var markedToday=new Answers(Answer.NO,Answer.NO,Answer.NO,480,4,0,Answer.NO,null,null);
        assertThat(service.submit("u",future,"Europe/Moscow",markedToday).entry().prediction().features())
                .containsEntry("cycleDay",1L);
    }
    @Test void startQuestionRepeatsUntilConfirmedAndManualTodayStillAsksEndTomorrow() {
        when(profiles.findById("u")).thenReturn(Optional.of(new QuestionnaireProfile("u",QuestionnaireProfile.Sex.FEMALE,null,true)));
        assertThat(service.status("u","Europe/Moscow").askCycle()).isTrue();
        service.submit("u",DAY,"Europe/Moscow",new Answers(Answer.NO,Answer.NO,Answer.NO,480,4,0,Answer.NO,Answer.NO,null));
        clock.now=Instant.parse("2026-11-04T09:00:00Z");
        assertThat(service.status("u","Europe/Moscow").askCycle()).isTrue();
        var id=CycleMarker.key("u",DAY.plusDays(1),CycleMarker.Kind.DAY);
        cycleSaved.put(id,new CycleMarker(id,"u",DAY.plusDays(1),CycleMarker.Kind.DAY,clock.now,"CALENDAR"));
        assertThat(service.status("u","Europe/Moscow").askCycle()).isFalse();
        clock.now=Instant.parse("2026-11-05T09:00:00Z");
        assertThat(service.status("u","Europe/Moscow").askCycleEnd()).isTrue();
    }
    @Test void retrospectivelyEnteredStartIsNotAvailableToEarlierPrediction() {
        when(profiles.findById("u")).thenReturn(Optional.of(new QuestionnaireProfile("u",QuestionnaireProfile.Sex.FEMALE,null,true)));
        var marker=new CycleMarker(CycleMarker.key("u",DAY.minusDays(3),CycleMarker.Kind.START),"u",DAY.minusDays(3),CycleMarker.Kind.START,clock.now.plusSeconds(60));
        when(cycleMarkers.findByUserIdOrderByDateAsc("u")).thenReturn(List.of(marker));
        var a=new Answers(Answer.NO,Answer.NO,Answer.NO,480,4,0,Answer.NO,Answer.NO,null);
        assertThat(service.submit("u",DAY,"Europe/Moscow",a).entry().prediction().features()).containsEntry("cycleDay",null);
    }
    @Test void gapsBreakAttendanceButOngoingAttackAndUnknownAnswersDoNot() {
        service.submit("u",DAY,"Europe/Moscow",answers(Answer.UNKNOWN));
        clock.now=Instant.parse("2026-11-05T09:00:00Z");
        assertThat(service.status("u","Europe/Moscow").currentStreak()).isZero();
        assertThat(service.submit("u",DAY.plusDays(2),"Europe/Moscow",answers(Answer.UNKNOWN)).currentStreak()).isEqualTo(1);
    }
    static class MutableClock extends Clock {
        Instant now; public ZoneId getZone(){return ZoneOffset.UTC;} public Clock withZone(ZoneId z){return this;} public Instant instant(){return now;}
    }
}
