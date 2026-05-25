package com.calm.feature.forecast.provider;

/**
 * Один кандидат геокодинга — для выбора города пользователем на онбординге.
 *
 * @param name      название города/населённого пункта
 * @param admin     административная единица (область/штат), может быть null
 * @param country   страна, может быть null
 * @param latitude  широта
 * @param longitude долгота
 */
public record GeocodingResult(
		String name,
		String admin,
		String country,
		double latitude,
		double longitude
) {}
