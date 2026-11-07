package com.calm.feature.risk;

import com.calm.feature.attack.*;
import com.calm.feature.forecast.ForecastService;
import com.calm.feature.medication.MedicationRepository;
import com.calm.feature.user.*;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class OnsetDataServiceTest {
    static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-11-03T23:59:10Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
    }
    static class Fixture {
        final MutableClock clock = new MutableClock();
        final SharedModelParticipationRepository participation = mock(SharedModelParticipationRepository.class);
        final UserRepository users = mock(UserRepository.class);
        final AttackRepository attacks = mock(AttackRepository.class);
        final MedicationRepository meds = mock(MedicationRepository.class);
        final DailyOutcomeRepository marks = mock(DailyOutcomeRepository.class);
        final OnsetInputRepository inputs = mock(OnsetInputRepository.class);
        final OnsetLabelRepository labels = mock(OnsetLabelRepository.class);
        final ForecastService forecast = mock(ForecastService.class);
        final Map<String, OnsetInputSnapshot> inputStore = new HashMap<>();
        final Map<String, OnsetDailyLabel> labelStore = new HashMap<>();
        final List<Attack> events = new ArrayList<>();
        final List<DailyOutcome> confirmations = new ArrayList<>();
        final User user = new User("test@example.test", "Synthetic", "hash");
        final SharedModelParticipation consent = new SharedModelParticipation("u1");
        final OnsetDataService service;
        Fixture() {
            user.setId("u1"); user.setLocationTimezone("UTC");
            consent.grant(SharedModelConsentPolicy.VERSION, SharedModelConsentPolicy.DIGEST, clock.instant());
            when(participation.findByUserId("u1")).thenReturn(Optional.of(consent));
            when(participation.findAll()).thenReturn(List.of(consent));
            when(users.findById("u1")).thenReturn(Optional.of(user));
            when(attacks.findByUserIdOrderByStartDateDescStartTimeDesc("u1")).thenReturn(events);
            when(attacks.findInRange(eq("u1"), any(), any())).thenReturn(events);
            when(meds.findInRange(eq("u1"), any(), any())).thenReturn(List.of());
            when(marks.findByUserId("u1")).thenReturn(confirmations);
            when(marks.findByUserIdAndDateBetween(eq("u1"), any(), any())).thenReturn(confirmations);
            when(inputs.existsById(anyString())).thenAnswer(c -> inputStore.containsKey(c.getArgument(0)));
            when(inputs.findByUserId("u1")).thenAnswer(c -> new ArrayList<>(inputStore.values()));
            when(inputs.insert(any(OnsetInputSnapshot.class))).thenAnswer(c -> {
                OnsetInputSnapshot value = c.getArgument(0); inputStore.put(value.id(), value); return value;
            });
            when(labels.findById(anyString())).thenAnswer(c -> Optional.ofNullable(labelStore.get(c.getArgument(0))));
            when(labels.findByUserId("u1")).thenAnswer(c -> new ArrayList<>(labelStore.values()));
            when(labels.save(any(OnsetDailyLabel.class))).thenAnswer(c -> {
                OnsetDailyLabel value = c.getArgument(0); labelStore.put(value.id(), value); return value;
            });
            service = new OnsetDataService(participation, users, attacks, meds, marks, inputs, labels, forecast, clock);
        }
        Attack attack(String id, String day, boolean ongoing) {
            var attack = new Attack(); attack.setId(id); attack.setUserId("u1");
            attack.setStartDate(LocalDate.parse(day)); attack.setStartTime(LocalTime.NOON);
            attack.setOngoing(ongoing); attack.setIntensity(5); events.add(attack); return attack;
        }
        OnsetDailyLabel label(String day) { return labelStore.get("u1_" + day); }
    }

    @Test void continuationAllowsZeroAndMidnightCompletesWithoutSecondConfirmation() {
        var f = new Fixture();
        f.attack("long", "2000-11-01", true);
        f.confirmations.add(DailyOutcome.noNewAttack("u1", LocalDate.parse("2026-11-03"), f.clock.instant(), "UTC"));
        f.service.refreshLabels("u1");
        assertThat(f.label("2026-11-03").outcome()).isZero();
        assertThat(f.label("2026-11-03").headachePresent()).isTrue();
        assertThat(f.label("2026-11-03").dayCompleted()).isFalse();
        f.clock.now = Instant.parse("2026-11-04T00:00:00Z");
        f.service.refreshLabels("u1");
        assertThat(f.label("2026-11-03").dayCompleted()).isTrue();
        assertThat(f.label("2026-11-03").labelSource()).isEqualTo("USER_NO_NEW_START_MARK");
        assertThat(f.labelStore).hasSize(2); // a 26-year interval creates no daily expansion
    }

    @Test void lateEntryChangesOnlyLabelAndDeletionReturnsUnknownNotInventedZero() {
        var f = new Fixture();
        var day = LocalDate.parse("2026-11-04");
        f.service.capture(f.user, day);
        var snapshot = f.inputStore.get("u1_2026-11-04");
        assertThat(snapshot.featureUsable()).isTrue();
        f.clock.now = Instant.parse("2026-11-05T00:00:00Z");
        f.confirmations.add(DailyOutcome.noNewAttack("u1", day, f.clock.instant().minusSeconds(600), "UTC"));
        f.service.refreshLabels("u1");
        assertThat(f.label("2026-11-04").outcome()).isZero();
        f.attack("backdated", "2026-11-04", false);
        f.confirmations.clear();
        f.service.refreshLabels("u1");
        assertThat(f.label("2026-11-04").outcome()).isEqualTo(1);
        assertThat(f.label("2026-11-04").revisions()).hasSize(2);
        f.events.clear();
        f.service.refreshLabels("u1");
        assertThat(f.label("2026-11-04").outcome()).isNull();
        assertThat(f.label("2026-11-04").revisions()).hasSize(3);
        f.service.capture(f.user, day);
        assertThat(f.inputStore.get("u1_2026-11-04")).isSameAs(snapshot);
        verify(f.inputs, times(1)).insert(any(OnsetInputSnapshot.class));
    }

    @Test void missingWeatherDoesNotPreventSnapshotAndLateCaptureIsExplicitlyUnusable() {
        var f = new Fixture();
        f.user.setLatitude(55.7); f.user.setLongitude(37.6);
        when(f.forecast.getForecast(anyDouble(), anyDouble())).thenThrow(new IllegalStateException("unavailable"));
        f.service.capture(f.user, LocalDate.parse("2026-11-04"));
        var onTime = f.inputStore.get("u1_2026-11-04");
        assertThat(onTime.featureUsable()).isTrue();
        assertThat(onTime.qualityFlags()).contains("WEATHER_UNAVAILABLE");
        f.clock.now = Instant.parse("2026-11-05T00:01:00Z");
        f.service.capture(f.user, LocalDate.parse("2026-11-05"));
        assertThat(f.inputStore.get("u1_2026-11-05").featureUsable()).isFalse();
        assertThat(f.inputStore.get("u1_2026-11-05").qualityFlags()).contains("OUTSIDE_MIDNIGHT_CAPTURE_WINDOW");
    }

    @Test void dstCalendarDayHasRealLocalBoundariesAndUnknownDayIsNotNegative() {
        var f = new Fixture(); f.user.setLocationTimezone("Europe/Berlin");
        f.clock.now = Instant.parse("2026-10-24T21:59:10Z");
        f.service.capture(f.user, LocalDate.parse("2026-10-25"));
        var snapshot = f.inputStore.get("u1_2026-10-25");
        assertThat(Duration.between(snapshot.plannedIssueAt(), snapshot.targetEndAt()).toHours()).isEqualTo(25);
        f.clock.now = Instant.parse("2026-10-26T00:30:00Z"); f.service.refreshLabels("u1");
        assertThat(f.label("2026-10-25").outcome()).isNull();
        assertThat(f.label("2026-10-25").dayCompleted()).isTrue();
    }

    @Test void withdrawalPurgesDerivedDataAndDoesNotReadMedicalDiary() {
        var f = new Fixture(); f.consent.withdraw(f.clock.instant());
        f.service.refreshLabels("u1");
        verify(f.inputs).deleteByUserId("u1"); verify(f.labels).deleteByUserId("u1");
        verifyNoInteractions(f.attacks, f.meds, f.marks, f.forecast);
    }
    @Test void explicitMarkTimezoneAllowsHistoryOnlyCaptureWithoutProfileCity() {
        var f = new Fixture(); f.user.setLocationTimezone(null);
        f.clock.now = Instant.parse("2026-11-03T20:59:10Z");
        f.confirmations.add(DailyOutcome.noNewAttack("u1", LocalDate.parse("2026-11-03"), f.clock.instant(), "Europe/Moscow"));
        f.service.capture(f.user, LocalDate.parse("2026-11-04"));
        var snapshot = f.inputStore.get("u1_2026-11-04");
        assertThat(snapshot.timezone()).isEqualTo("Europe/Moscow");
        assertThat(snapshot.featureUsable()).isTrue();
        assertThat(snapshot.qualityFlags()).contains("LOCATION_MISSING").doesNotContain("TIMEZONE_UNKNOWN");
    }

}
