package com.calm.feature.risk;

import com.calm.feature.attack.AttackRepository;
import com.calm.feature.attack.Attack;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class DailyOutcomeServiceTest {
	@Test
	void allowsConfirmingTodayBeforeTheDayEnds() {
		var outcomes = mock(DailyOutcomeRepository.class);
		var attacks = mock(AttackRepository.class);
		var predictions = mock(RiskPredictionRecordRepository.class);
		var service = new DailyOutcomeService(outcomes, attacks, predictions);
		var today = LocalDate.now(ZoneId.of("UTC"));
		when(attacks.findInRange("user-1", today, today)).thenReturn(List.of());
		when(outcomes.save(any(DailyOutcome.class))).thenAnswer(call -> {
            DailyOutcome mark = call.getArgument(0);
            when(outcomes.findByUserIdAndDate(mark.getUserId(), mark.getDate())).thenReturn(Optional.of(mark));
            return mark;
        });

		assertThat(service.confirmNoAttack("user-1", today, "UTC").status())
				.isEqualTo(DailyOutcomeResponse.Status.NO_ATTACK_STARTED);
		verify(outcomes).save(any(DailyOutcome.class));
	}

	@Test
	void rejectsFutureDay() {
		var outcomes = mock(DailyOutcomeRepository.class);
		var attacks = mock(AttackRepository.class);
		var predictions = mock(RiskPredictionRecordRepository.class);
		var service = new DailyOutcomeService(outcomes, attacks, predictions);
		var tomorrow = LocalDate.now(ZoneId.of("UTC")).plusDays(1);

		assertThatThrownBy(() -> service.confirmNoAttack("user-1", tomorrow, "UTC"))
				.isInstanceOf(ResponseStatusException.class);
		verify(outcomes, never()).save(any());
	}

	@Test
	void usesForecastTimezoneInsteadOfBrowserTimezoneForCompletionCheck() {
		var outcomes = mock(DailyOutcomeRepository.class);
		var attacks = mock(AttackRepository.class);
		var predictions = mock(RiskPredictionRecordRepository.class);
		var service = new DailyOutcomeService(outcomes, attacks, predictions);
		var date = LocalDate.now(ZoneId.of("Asia/Tokyo")).minusDays(1);
		var prediction = new RiskPredictionRecord("user-1", date, Instant.now(), "Asia/Tokyo",
				42, RiskLevel.MEDIUM, 1, "personal-rules-v1", null);
		when(predictions.findFirstByUserIdAndTargetDateOrderByIssuedAtDesc("user-1", date))
				.thenReturn(Optional.of(prediction));
		when(attacks.findInRange("user-1", date, date)).thenReturn(List.of());
		when(outcomes.findByUserIdAndDate("user-1", date)).thenReturn(Optional.empty());
		when(outcomes.save(any(DailyOutcome.class))).thenAnswer(call -> {
            DailyOutcome mark = call.getArgument(0);
            when(outcomes.findByUserIdAndDate(mark.getUserId(), mark.getDate())).thenReturn(Optional.of(mark));
            return mark;
        });

		var result = service.confirmNoAttack("user-1", date, "Not/A-Timezone");

		assertThat(result.status()).isEqualTo(DailyOutcomeResponse.Status.NO_ATTACK_STARTED);
		verify(outcomes).save(any(DailyOutcome.class));
	}

	@Test
	void fallsBackToBrowserTimezoneWhenThereIsNoForecastSnapshot() {
		var outcomes = mock(DailyOutcomeRepository.class);
		var attacks = mock(AttackRepository.class);
		var predictions = mock(RiskPredictionRecordRepository.class);
		var service = new DailyOutcomeService(outcomes, attacks, predictions);
		var date = LocalDate.now().minusDays(1);
		when(predictions.findFirstByUserIdAndTargetDateOrderByIssuedAtDesc("user-1", date))
				.thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.confirmNoAttack("user-1", date, "Not/A-Timezone"))
				.isInstanceOf(ResponseStatusException.class);
		verify(outcomes, never()).save(any());
	}

	@Test
	void continuationDoesNotBlockNoNewStartMark() {
		var outcomes = mock(DailyOutcomeRepository.class);
		var attacks = mock(AttackRepository.class);
		var predictions = mock(RiskPredictionRecordRepository.class);
		var service = new DailyOutcomeService(outcomes, attacks, predictions);
		var day = LocalDate.now(ZoneId.of("UTC")).minusDays(1);
		var attack = new Attack();
		attack.setStartDate(day.minusDays(2));
		attack.setEndDate(day);
		when(attacks.findInRange("user-1", day, day)).thenReturn(List.of(attack));
		assertThat(service.get("user-1", day).status()).isEqualTo(DailyOutcomeResponse.Status.UNKNOWN);
        assertThat(service.get("user-1", day).headachePresent()).isTrue();
        when(outcomes.save(any(DailyOutcome.class))).thenAnswer(call -> {
            DailyOutcome mark = call.getArgument(0);
            when(outcomes.findByUserIdAndDate("user-1", day)).thenReturn(Optional.of(mark));
            return mark;
        });
        assertThat(service.confirmNoAttack("user-1", day, "UTC").status())
            .isEqualTo(DailyOutcomeResponse.Status.NO_ATTACK_STARTED);
        verify(outcomes).save(any());
	}
    @Test void concurrentNewStartCannotLeaveHiddenNegativeMark() {
        var outcomes = mock(DailyOutcomeRepository.class);
        var attacks = mock(AttackRepository.class);
        var predictions = mock(RiskPredictionRecordRepository.class);
        var day = LocalDate.now(ZoneId.of("UTC")).minusDays(1);
        var attack = new Attack(); attack.setStartDate(day);
        when(attacks.findInRange("u", day, day)).thenReturn(List.of(), List.of(attack));
        var service = new DailyOutcomeService(outcomes, attacks, predictions);
        assertThatThrownBy(() -> service.confirmNoAttack("u", day, "UTC"))
            .isInstanceOf(ResponseStatusException.class);
        verify(outcomes).deleteByUserIdAndDate("u", day);
    }

}
