package com.calm.feature.forecast.dto;

import java.time.Instant;
import java.util.List;

/**
 * Ответ на {@code GET /forecast}: список дней + meta-инфо для фронта.
 *
 * @param provider название активного провайдера (для отладки/админки)
 * @param days     прогноз (сегодня + N дней)
 * @param stale    true если данные взяты из устаревшего кэша (API недоступен)
 * @param cachedAt время когда данные были получены от провайдера; фронт показывает в баннере
 */
public record ForecastResponse(
		String provider,
		List<ForecastDayDto> days,
		boolean stale,
		Instant cachedAt
) {}
