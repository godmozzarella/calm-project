package com.calm.feature.forecast.dto;

import com.calm.feature.forecast.provider.GeocodingResult;

/**
 * Кандидат геокодинга в формате, отдаваемом фронту.
 */
public record GeocodingDto(
		String name,
		String admin,
		String country,
		double latitude,
		double longitude
) {
	public static GeocodingDto from(GeocodingResult r) {
		return new GeocodingDto(r.name(), r.admin(), r.country(), r.latitude(), r.longitude());
	}
}
