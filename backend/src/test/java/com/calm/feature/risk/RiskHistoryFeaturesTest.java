package com.calm.feature.risk;

import com.calm.feature.attack.Attack;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RiskHistoryFeaturesTest {
	@Test
	void usesOnlyStartsBeforeTargetAndKeepsNoHistoryUnknown() {
		LocalDate target = LocalDate.of(2026, 10, 12);
		RiskHistoryFeatures history = RiskHistoryFeatures.from(List.of(
				attack(target.minusDays(1), 8),
				attack(target.minusDays(14), 4),
				attack(target.minusDays(30), 6),
				attack(target.minusDays(31), 10),
				attack(target, 9),
				attack(target.plusDays(1), 10)), target, target.minusDays(1));

		assertThat(history.attackStartsLast14Days()).isEqualTo(2);
		assertThat(history.attackStartsLast30Days()).isEqualTo(3);
		assertThat(history.meanAttackIntensityLast30Days()).isEqualTo(6.0);
		assertThat(history.daysSinceLastAttackStart()).isEqualTo(1);
		RiskHistoryFeatures issuedEarlier = RiskHistoryFeatures.from(
				List.of(attack(target.minusDays(1), 8), attack(target.minusDays(3), 5)),
				target, target.minusDays(2));
		assertThat(issuedEarlier.attackStartsLast30Days()).isEqualTo(1);
		assertThat(issuedEarlier.daysSinceLastAttackStart()).isEqualTo(3);

		RiskHistoryFeatures empty = RiskHistoryFeatures.from(List.of(attack(target.minusDays(91), 7)),
				target, target.minusDays(1));
		assertThat(empty.attackStartsLast30Days()).isZero();
		assertThat(empty.meanAttackIntensityLast30Days()).isNull();
		assertThat(empty.daysSinceLastAttackStart()).isNull();
	}

	private static Attack attack(LocalDate start, int intensity) {
		Attack attack = new Attack();
		attack.setStartDate(start);
		attack.setIntensity(intensity);
		return attack;
	}
}
