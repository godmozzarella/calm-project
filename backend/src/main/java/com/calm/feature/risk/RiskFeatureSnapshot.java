package com.calm.feature.risk;

/** Минимальный снимок числовых входов, известных алгоритму на момент выдачи оценки. */
public record RiskFeatureSnapshot(
		Integer weatherScore,
		Double pressureMmHg,
		Double pressureDelta24hMmHg,
		Double humidity,
		Double humidityDelta24h,
		Double tempMin,
		Double tempMax,
		Double windKmhMax,
		Double kpIndex,
		int attacksLast3Days,
		int attacksLast7Days,
		int medicationDaysLast7Days,
		boolean overuseRisk,
		int historyDays,
		int historyAttackDays,
		int attackStartsLast14Days,
		int attackStartsLast30Days,
		Double meanAttackIntensityLast30Days,
		Integer daysSinceLastAttackStart
) {
	public static RiskFeatureSnapshot from(RiskPredictionResponse.RiskInputs inputs, RiskHistoryFeatures history) {
		if (inputs == null) return null;
		return new RiskFeatureSnapshot(
				inputs.weatherScore(), inputs.pressureMmHg(), inputs.pressureDelta24hMmHg(), inputs.humidity(),
				inputs.humidityDelta24h(),
				inputs.tempMin(), inputs.tempMax(), inputs.windKmhMax(), inputs.kpIndex(),
				inputs.attacksLast3Days(), inputs.attacksLast7Days(), inputs.medicationDaysLast7Days(),
				inputs.overuseRisk(), inputs.historyDays(), inputs.historyAttackDays(),
				history.attackStartsLast14Days(), history.attackStartsLast30Days(),
				history.meanAttackIntensityLast30Days(), history.daysSinceLastAttackStart());
	}
}
