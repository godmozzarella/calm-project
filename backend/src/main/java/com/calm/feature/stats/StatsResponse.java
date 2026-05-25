package com.calm.feature.stats;

import java.util.List;
import java.util.Map;

public record StatsResponse(
		KpisDto kpis,
		List<BucketDto> buckets,
		PatternsDto patterns,
		WeatherCorrelationDto weather
) {

	public record KpisDto(
			int total,
			double avgIntensity,
			int longestStreak,
			int overuseDays,
			boolean overuseRisk
	) {}

	public record BucketDto(
			String key,
			String label,
			String fromKey,
			String toKey,
			String dateKey,      // non-null only when bucket = single day
			int count,
			int maxIntensity
	) {}

	public record PatternsDto(
			List<TagCountDto> topTriggers,
			List<TagCountDto> topSymptoms,
			ZonesDto zones,
			List<MedStatDto> meds
	) {}

	public record TagCountDto(String key, String label, int count, double share) {}

	public record ZonesDto(Map<String, Integer> freq, Map<String, String> colorMap, int max) {}

	public record MedStatDto(String name, int count, Double avgEff, int withRating) {}

	/**
	 * Корреляция «приступ ↔ погода».
	 *
	 * @param daysCovered           — сколько дней в периоде у нас есть снимок погоды
	 * @param attacksTotal          — всего приступов в периоде (среди дней с погодой)
	 * @param attacksOnElevatedRisk — из них в дни с risk = MEDIUM или HIGH
	 * @param avgRiskOnAttackDays   — средний риск-скор в дни с приступом (0–100)
	 * @param avgRiskOnPainFreeDays — средний риск-скор в дни без приступа (0–100)
	 * @param avgPressureOnAttack   — среднее давление, гПа, в дни приступа (или null)
	 * @param avgPressureOnPainFree — среднее давление, гПа, в дни без приступа (или null)
	 *
	 * <p>Если {@code daysCovered} меньше ~7, корреляция статистически бесполезна — фронт показывает «недостаточно данных».
	 */
	public record WeatherCorrelationDto(
			int daysCovered,
			int attacksTotal,
			int attacksOnElevatedRisk,
			Double avgRiskOnAttackDays,
			Double avgRiskOnPainFreeDays,
			Double avgPressureOnAttack,
			Double avgPressureOnPainFree
	) {}
}
