package com.calm.feature.risk;

import java.time.LocalDate;
import java.util.List;

public record RiskPredictionResponse(
		LocalDate date,
		int score,
		RiskLevel level,
		String historyLevel,
		boolean dataAvailable,
		String message,
		List<String> reasons,
		List<String> personalFactors,
		RiskInputs inputs
) {
	public record RiskInputs(
			Integer weatherScore,
			Double pressureHpa,
			Double pressureDelta24h,
			Double humidity,
			Double tempMin,
			Double tempMax,
			Double windKmhMax,
			Double kpIndex,
			int attacksLast3Days,
			int attacksLast7Days,
			int medicationDaysLast7Days,
			boolean overuseRisk,
			int historyDays,
			int historyAttackDays
	) {}
}
