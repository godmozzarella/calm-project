package com.calm.feature.risk;

import com.calm.feature.attack.Attack;
import com.calm.feature.attack.AttackType;
import com.calm.feature.medication.Medication;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class TrainingHistoryDetailsTest {
	@Test
	void freezesOnlyKnownPredayDiaryDetails() {
		LocalDate target = LocalDate.of(2026, 10, 17);
		Attack attack = new Attack();
		attack.setStartDate(target.minusDays(1));
		attack.setOngoing(true);
		attack.setType(AttackType.PULSATING);
		attack.setSymptoms(Set.of("nausea"));
		attack.setTriggers(Set.of("stress"));
		attack.setPainZones(Map.of("forehead", "red"));
		Attack future = new Attack();
		future.setStartDate(target);
		future.setType(AttackType.PRESSING);
		Medication medication = new Medication();
		medication.setDate(target.minusDays(1));
		medication.setName("test medicine");
		medication.setTherapeuticClass("nsaid");
		medication.setEffectiveness(3);
		medication.setAttackId("attack-1");
		Medication futureMedication = new Medication();
		futureMedication.setDate(target);
		futureMedication.setEffectiveness(1);

		TrainingHistoryDetails result = TrainingHistoryDetails.from(
				List.of(attack, future), List.of(medication, futureMedication), target, target.minusDays(1));

		assertThat(result.painTypesLast30Days())
				.containsExactly(new TrainingHistoryDetails.CodeCount("PULSATING", 1));
		assertThat(result.symptomsLast30Days())
				.containsExactly(new TrainingHistoryDetails.CodeCount("nausea", 1));
		assertThat(result.triggersLast30Days())
				.containsExactly(new TrainingHistoryDetails.CodeCount("stress", 1));
		assertThat(result.painZonesLast30Days())
				.containsExactly(new TrainingHistoryDetails.CodeCount("forehead:red", 1));
		assertThat(result.medicationNamesLast30Days())
				.containsExactly(new TrainingHistoryDetails.CodeCount("test medicine", 1));
		assertThat(result.medicationEffectivenessLast30Days())
				.containsExactly(new TrainingHistoryDetails.CodeCount("3", 1));
		assertThat(result.linkedMedicationEntriesLast30Days()).isEqualTo(1);
		assertThat(result.ongoingAttackAtCutoff()).isTrue();
	}
}
