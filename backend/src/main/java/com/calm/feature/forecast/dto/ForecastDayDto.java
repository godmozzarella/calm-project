package com.calm.feature.forecast.dto;

import com.calm.feature.forecast.RiskLevel;

import java.time.LocalDate;
import java.util.List;

/**
 * Дневной прогноз с уже посчитанным уровнем риска и человеко-читаемыми пояснениями.
 *
 * @param date              календарная дата
 * @param risk              уровень риска ({@code LOW/MEDIUM/HIGH})
 * @param score             численный риск-скор 0..100 (для интерполяций на фронте)
 * @param reasons           список причин, по которым риск повышен (давление в мм рт. ст.)
 * @param pressureMmHg      среднее давление, мм рт. ст. (или null)
 * @param pressureDelta24hMmHg изменение давления за 24ч, мм рт. ст. (или null)
 * @param humidity          средняя влажность, % (или null)
 * @param humidityDelta24h  изменение средней влажности за сутки, п.п. (или null)
 * @param tempMin           минимальная температура, °C (или null)
 * @param tempMax           максимальная температура, °C (или null)
 * @param windKmhMax        максимум порывов ветра, км/ч (или null)
 * @param kpIndex           максимальный Kp-индекс геомагнитной активности за сутки (0–9, null если недоступно)
 */
public record ForecastDayDto(
		LocalDate date,
		RiskLevel risk,
		int score,
		List<String> reasons,
		Double pressureMmHg,
		Double pressureDelta24hMmHg,
		Double humidity,
		Double humidityDelta24h,
		Double tempMin,
		Double tempMax,
		Double windKmhMax,
		Double kpIndex,
		String timezone
) {}
