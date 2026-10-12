package com.calm.feature.risk;

import com.calm.feature.attack.AttackRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class DailyOutcomeServiceTest {
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
		when(attacks.existsByUserIdAndStartDate("user-1", date)).thenReturn(false);
		when(outcomes.findByUserIdAndDate("user-1", date)).thenReturn(Optional.empty());
		when(outcomes.save(any(DailyOutcome.class))).thenAnswer(call -> call.getArgument(0));

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
}
