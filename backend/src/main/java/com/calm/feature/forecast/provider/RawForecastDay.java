package com.calm.feature.forecast.provider;

import java.time.LocalDate;

/**
 * Нормализованный дневной прогноз — единая модель, к которой приводят свои ответы
 * все {@link WeatherProvider}-реализации. Дальше {@code ForecastService} считает
 * по этим данным риск-скор, не зная ничего про конкретного провайдера.
 *
 * <p>Поля могут быть {@code null}, если провайдер не отдаёт соответствующий показатель.
 *
 * @param date              календарная дата (в часовой зоне локации)
 * @param pressureHpaAvg    среднее атмосферное давление за сутки, гПа
 * @param pressureDelta24h  изменение давления за последние 24ч относительно
 *                          предыдущих суток, гПа (резкое падение — повышенный риск)
 * @param humidityAvg       средняя относительная влажность за сутки, %
 * @param humidityDelta24h  изменение средней влажности относительно предыдущих суток, п.п.
 * @param tempMin           минимум температуры, °C
 * @param tempMax           максимум температуры, °C
 * @param windKmhMax        максимум порывов ветра, км/ч
 * @param kpIndex           максимальный Kp-индекс геомагнитной активности за сутки (0–9),
 *                          заполняется из NOAA SWPC; null если данные недоступны
 */
public record RawForecastDay(
		LocalDate date,
		Double pressureHpaAvg,
		Double pressureDelta24h,
		Double humidityAvg,
		Double humidityDelta24h,
		Double tempMin,
		Double tempMax,
		Double windKmhMax,
		Double kpIndex,
		String timezone
) {
	/** Конструктор без kpIndex — обратная совместимость с OpenMeteoProvider. */
	public RawForecastDay(LocalDate date, Double pressureHpaAvg, Double pressureDelta24h,
	                      Double humidityAvg, Double tempMin, Double tempMax, Double windKmhMax) {
		this(date, pressureHpaAvg, pressureDelta24h, humidityAvg, null, tempMin, tempMax, windKmhMax, null, null);
	}

	public RawForecastDay withKpIndex(Double kp) {
		return new RawForecastDay(date, pressureHpaAvg, pressureDelta24h, humidityAvg, humidityDelta24h,
				tempMin, tempMax, windKmhMax, kp, timezone);
	}
}
