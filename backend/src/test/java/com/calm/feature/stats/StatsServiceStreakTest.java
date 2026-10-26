package com.calm.feature.stats;

import com.calm.feature.attack.AttackRepository;
import com.calm.feature.attack.Attack;
import com.calm.feature.dictionary.DictionaryRepository;
import com.calm.feature.forecast.snapshot.ForecastSnapshotService;
import com.calm.feature.medication.MedicationRepository;
import com.calm.feature.risk.DailyOutcome;
import com.calm.feature.risk.DailyOutcomeRepository;
import com.calm.feature.user.UserRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StatsServiceStreakTest {
	@Test
	void emptyDiaryDoesNotInventPainFreeDays() {
		StatsResponse.KpisDto kpis = service(List.of(), false).compute("u", "year").kpis();
		assertThat(kpis.longestStreak()).isZero();
		assertThat(kpis.currentStreak()).isZero();
	}

	@Test
	void confirmedDaysCountAndTodaysAttackResetsCurrentSeries() {
		LocalDate today = LocalDate.now();
		var confirmations = List.of(
				new DailyOutcome("u", today.minusDays(4), Instant.now()),
				new DailyOutcome("u", today.minusDays(2), Instant.now()),
				new DailyOutcome("u", today.minusDays(1), Instant.now()));
		StatsResponse.KpisDto withoutAttack = service(confirmations, false).compute("u", "month").kpis();
		assertThat(withoutAttack.longestStreak()).isEqualTo(2);
		assertThat(withoutAttack.currentStreak()).isEqualTo(2);
		StatsResponse.KpisDto withAttackToday = service(confirmations, true).compute("u", "month").kpis();
		assertThat(withAttackToday.longestStreak()).isEqualTo(2);
		assertThat(withAttackToday.currentStreak()).isZero();
	}

	@Test
	void confirmedTodayExtendsCurrentSeriesImmediately() {
		LocalDate today = LocalDate.now();
		var confirmations = List.of(
				new DailyOutcome("u", today.minusDays(2), Instant.now()),
				new DailyOutcome("u", today.minusDays(1), Instant.now()),
				new DailyOutcome("u", today, Instant.now()));

		var kpis = service(confirmations, false).compute("u", "month").kpis();

		assertThat(kpis.currentStreak()).isEqualTo(3);
		assertThat(kpis.longestStreak()).isEqualTo(2);
	}

	private StatsService service(List<DailyOutcome> confirmations, boolean attackToday) {
		var attacks = mock(AttackRepository.class);
		var medications = mock(MedicationRepository.class);
		var dictionaries = mock(DictionaryRepository.class);
		var users = mock(UserRepository.class);
		var snapshots = mock(ForecastSnapshotService.class);
		var outcomes = mock(DailyOutcomeRepository.class);
		when(attacks.findInRange(eq("u"), any(), any())).thenAnswer(call -> {
			LocalDate from = call.getArgument(1);
			LocalDate to = call.getArgument(2);
			if (!attackToday || !from.equals(LocalDate.now()) || !to.equals(from)) return List.of();
			Attack attack = new Attack();
			attack.setStartDate(from);
			return List.of(attack);
		});
		when(medications.findInRange(eq("u"), any(), any())).thenReturn(List.of());
		when(dictionaries.findByTypeOrderByOrderAscLabelAsc(any())).thenReturn(List.of());
		when(users.findById("u")).thenReturn(Optional.empty());
		when(outcomes.findByUserIdAndDateBetween(eq("u"), any(), any())).thenAnswer(call -> {
			LocalDate from = call.getArgument(1);
			LocalDate to = call.getArgument(2);
			return confirmations.stream().filter(day -> !day.getDate().isBefore(from) && !day.getDate().isAfter(to)).toList();
		});
		return new StatsService(attacks, medications, dictionaries, users, snapshots, outcomes);
	}
}
