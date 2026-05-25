package com.calm.feature.forecast.dto;

import java.util.List;

/**
 * Ответ на {@code GET /forecast}: список дней + meta-инфо для фронта.
 *
 * @param provider название активного провайдера (для отладки/админки)
 * @param days     прогноз (сегодня + N дней)
 */
public record ForecastResponse(
		String provider,
		List<ForecastDayDto> days
) {}
