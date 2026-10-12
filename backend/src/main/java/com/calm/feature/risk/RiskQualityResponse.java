package com.calm.feature.risk;

import java.time.LocalDate;

/** Качество сохранённых прогнозов на завершённые дни, а не оценка вероятности. */
public record RiskQualityResponse(
		LocalDate from,
		LocalDate to,
		int daysCovered,
		int attackDays,
		int alertDays,
		int hitDays,
		int missedAttackDays,
		int falseAlertDays,
		Integer precisionPercent,
		Integer recallPercent,
		Integer baselineAttackRatePercent,
		boolean enoughData
) {}
