package com.calm.feature.risk;

import com.calm.feature.attack.Attack;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Агрегаты только по приступам, начало которых предшествует прогнозируемому дню. */
record RiskHistoryFeatures(int attackStartsLast14Days, int attackStartsLast30Days,
		Double meanAttackIntensityLast30Days, Integer daysSinceLastAttackStart) {
	static RiskHistoryFeatures from(List<Attack> attacks, LocalDate targetDate, LocalDate knownThrough) {
		Set<LocalDate> starts14 = new HashSet<>();
		Set<LocalDate> starts30 = new HashSet<>();
		double intensitySum = 0;
		int intensityCount = 0;
		LocalDate lastStart = null;
		for (Attack attack : attacks) {
			LocalDate start = attack.getStartDate();
			if (start == null || !start.isBefore(targetDate) || start.isAfter(knownThrough)) continue;
			if (!start.isBefore(targetDate.minusDays(90)) &&
					(lastStart == null || start.isAfter(lastStart))) lastStart = start;
			if (start.isBefore(targetDate.minusDays(30))) continue;
			starts30.add(start);
			if (!start.isBefore(targetDate.minusDays(14))) starts14.add(start);
			if (attack.getIntensity() >= 1 && attack.getIntensity() <= 10) {
				intensitySum += attack.getIntensity();
				intensityCount++;
			}
		}
		return new RiskHistoryFeatures(starts14.size(), starts30.size(),
				intensityCount == 0 ? null : intensitySum / intensityCount,
				lastStart == null ? null : Math.toIntExact(ChronoUnit.DAYS.between(lastStart, targetDate)));
	}
}
