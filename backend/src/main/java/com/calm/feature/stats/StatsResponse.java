package com.calm.feature.stats;

import java.util.List;
import java.util.Map;

public record StatsResponse(KpisDto kpis, List<BucketDto> buckets, PatternsDto patterns) {

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
}
