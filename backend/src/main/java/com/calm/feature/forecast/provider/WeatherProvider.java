package com.calm.feature.forecast.provider;

import java.util.List;

/**
 * Поставщик данных о погоде. Реализации регистрируются как Spring-бины и
 * выбираются по ключу из {@code SystemSettings.weather.activeProvider}.
 *
 * <p>Поставщик отвечает за две вещи:
 * <ul>
 *   <li>тянуть прогноз и приводить ответ к {@link RawForecastDay};</li>
 *   <li>опционально — отдавать геокодинг (поиск города по строке).</li>
 * </ul>
 *
 * <p>Логика расчёта риска мигрени лежит выше — в сервисе, и от провайдера не зависит.
 */
public interface WeatherProvider {

	/**
	 * Стабильный машинный ключ провайдера (например {@code "openmeteo"}).
	 * Используется как идентификатор в {@code SystemSettings} и логах.
	 */
	String getKey();

	/**
	 * Прогноз на сегодня + следующие {@code daysAhead} дней.
	 *
	 * @param latitude   широта
	 * @param longitude  долгота
	 * @param daysAhead  сколько дней вперёд после сегодняшнего (обычно 3)
	 * @return нормализованный список длиной {@code daysAhead + 1}, в порядке возрастания даты
	 */
	List<RawForecastDay> fetchForecast(double latitude, double longitude, int daysAhead);

	/**
	 * Поиск города/места по строке. Реализуется не всеми провайдерами.
	 *
	 * @param query      текстовый запрос ("Москва", "St. Petersburg")
	 * @param limit      максимум кандидатов в ответе
	 * @return список кандидатов, возможно пустой
	 * @throws UnsupportedOperationException если провайдер не поддерживает геокодинг
	 */
	default List<GeocodingResult> geocode(String query, int limit) {
		throw new UnsupportedOperationException("Geocoding не поддерживается провайдером " + getKey());
	}

	/**
	 * Reverse-геокодинг: по координатам отдать ближайший населённый пункт (с названием
	 * и страной). Нужен для онбординга, когда юзер разрешил {@code navigator.geolocation}
	 * — чтобы показать понятное «Москва, Россия» вместо безликих координат.
	 *
	 * @return найденный результат, либо {@code null} если ничего не найдено
	 */
	default GeocodingResult reverseGeocode(double latitude, double longitude) {
		return null;
	}
}
