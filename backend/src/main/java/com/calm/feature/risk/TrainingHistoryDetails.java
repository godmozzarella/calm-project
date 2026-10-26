package com.calm.feature.risk;

import com.calm.feature.attack.Attack;
import com.calm.feature.medication.Medication;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Only diary facts available when the next-day input snapshot was captured. */
public record TrainingHistoryDetails(
		List<CodeCount> painTypesLast30Days,
		List<CodeCount> symptomsLast30Days,
		List<CodeCount> triggersLast30Days,
		List<CodeCount> painZonesLast30Days,
		List<CodeCount> medicationNamesLast30Days,
		List<CodeCount> medicationClassesLast30Days,
		List<CodeCount> medicationEffectivenessLast30Days,
		int linkedMedicationEntriesLast30Days,
		boolean ongoingAttackAtCutoff
) {
	public record CodeCount(String code, int count) {}

	static TrainingHistoryDetails from(List<Attack> attacks, List<Medication> medications,
			LocalDate targetDate, LocalDate knownThrough) {
		Map<String, Integer> types = new HashMap<>();
		Map<String, Integer> symptoms = new HashMap<>();
		Map<String, Integer> triggers = new HashMap<>();
		Map<String, Integer> zones = new HashMap<>();
		Map<String, Integer> medicationNames = new HashMap<>();
		Map<String, Integer> classes = new HashMap<>();
		Map<String, Integer> effects = new HashMap<>();
		int linked = 0;
		boolean ongoing = false;
		LocalDate from = targetDate.minusDays(30);
		for (Attack attack : attacks) {
			LocalDate start = attack.getStartDate();
			if (start == null || start.isAfter(knownThrough)) continue;
			if (attack.isOngoing() && attack.overlaps(knownThrough)) ongoing = true;
			if (start.isBefore(from) || !start.isBefore(targetDate)) continue;
			if (attack.getType() != null) increment(types, attack.getType().name());
			if (attack.getSymptoms() != null) attack.getSymptoms().forEach(value -> increment(symptoms, value));
			if (attack.getTriggers() != null) attack.getTriggers().forEach(value -> increment(triggers, value));
			if (attack.getPainZones() != null) attack.getPainZones()
					.forEach((zone, color) -> increment(zones, zone + ":" + color));
		}
		for (Medication medication : medications) {
			LocalDate date = medication.getDate();
			if (date == null || date.isBefore(from) || date.isAfter(knownThrough)) continue;
			increment(medicationNames, medication.trainingName());
			increment(classes, medication.getTherapeuticClass());
			if (medication.getEffectiveness() != null && medication.getEffectiveness() >= 1
					&& medication.getEffectiveness() <= 3) {
				increment(effects, String.valueOf(medication.getEffectiveness()));
			}
			if (medication.getAttackId() != null && !medication.getAttackId().isBlank()) linked++;
		}
		return new TrainingHistoryDetails(entries(types), entries(symptoms), entries(triggers),
				entries(zones), entries(medicationNames), entries(classes), entries(effects), linked, ongoing);
	}

	private static List<CodeCount> entries(Map<String, Integer> counts) {
		return counts.entrySet().stream().sorted(Map.Entry.comparingByKey())
				.map(entry -> new CodeCount(entry.getKey(), entry.getValue())).toList();
	}

	private static void increment(Map<String, Integer> counts, String value) {
		if (value != null && !value.isBlank()) counts.merge(value, 1, Integer::sum);
	}
}
