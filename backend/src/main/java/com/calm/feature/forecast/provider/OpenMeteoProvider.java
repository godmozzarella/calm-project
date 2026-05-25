package com.calm.feature.forecast.provider;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Реализация {@link WeatherProvider} поверх Open-Meteo (бесплатно, без API-ключа).
 *
 * <p>Forecast endpoint: {@code https://api.open-meteo.com/v1/forecast}<br>
 * Geocoding endpoint: {@code https://geocoding-api.open-meteo.com/v1/search}
 *
 * <p>Берём почасовое давление и влажность, дневные min/max температуры и порывы ветра.
 * Чтобы посчитать Δ давления за 24ч на день N, запрашиваем на 1 день назад
 * относительно {@code daysAhead} ({@code past_days=1}).
 */
@Component
public class OpenMeteoProvider implements WeatherProvider {

	public static final String KEY = "openmeteo";

	private static final Logger log = LoggerFactory.getLogger(OpenMeteoProvider.class);
	private static final String FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";
	private static final String GEOCODE_BASE  = "https://geocoding-api.open-meteo.com/v1/search";
	// Open-Meteo не отдаёт reverse-геокодинг, поэтому для определения города по
	// координатам используем Nominatim (OSM). Тоже бесплатно, но с лимитом 1 req/sec —
	// для нашего онбординга более чем достаточно.
	private static final String REVERSE_GEOCODE_BASE = "https://nominatim.openstreetmap.org/reverse";

	// Open-Meteo блокирует запросы без User-Agent через 403. Любая внятная строка подходит.
	private final RestClient http = RestClient.builder()
			.defaultHeader("Accept", "application/json")
			.defaultHeader("User-Agent", "Calm-Headache-Tracker/1.0 (+https://calm.local)")
			.build();

	@Override
	public String getKey() {
		return KEY;
	}

	@Override
	public List<RawForecastDay> fetchForecast(double latitude, double longitude, int daysAhead) {
		int forecastDays = Math.max(1, daysAhead) + 1; // сегодня + N
		String url = FORECAST_BASE
				+ "?latitude=" + latitude
				+ "&longitude=" + longitude
				+ "&hourly=surface_pressure,relative_humidity_2m"
				+ "&daily=temperature_2m_max,temperature_2m_min,wind_gusts_10m_max"
				+ "&past_days=1"
				+ "&forecast_days=" + forecastDays
				+ "&timezone=auto";

		JsonNode root;
		try {
			root = http.get().uri(URI.create(url)).retrieve().body(JsonNode.class);
		} catch (Exception e) {
			log.warn("Open-Meteo forecast не отвечает: {}", e.getMessage());
			return Collections.emptyList();
		}
		if (root == null) return Collections.emptyList();

		JsonNode hourly = root.path("hourly");
		JsonNode daily  = root.path("daily");

		List<String> hourlyTimes = readStringArray(hourly.path("time"));
		List<Double> hourlyPressure = readDoubleArray(hourly.path("surface_pressure"));
		List<Double> hourlyHumidity = readDoubleArray(hourly.path("relative_humidity_2m"));

		List<String> dailyTimes = readStringArray(daily.path("time"));
		List<Double> dailyTempMax = readDoubleArray(daily.path("temperature_2m_max"));
		List<Double> dailyTempMin = readDoubleArray(daily.path("temperature_2m_min"));
		List<Double> dailyWindGusts = readDoubleArray(daily.path("wind_gusts_10m_max"));

		List<RawForecastDay> result = new ArrayList<>();
		LocalDate today = LocalDate.now();

		for (int i = 0; i < dailyTimes.size(); i++) {
			LocalDate date;
			try {
				date = LocalDate.parse(dailyTimes.get(i));
			} catch (Exception ex) {
				continue;
			}
			// Пропускаем past_days=1 — нам нужен только сегодня + вперёд.
			if (date.isBefore(today)) continue;

			Double pressureAvg = averageForDay(hourlyTimes, hourlyPressure, date);
			Double humidityAvg = averageForDay(hourlyTimes, hourlyHumidity, date);
			Double pressureDelta = pressureAvg != null
					? deltaVsPreviousDay(hourlyTimes, hourlyPressure, date, pressureAvg)
					: null;

			result.add(new RawForecastDay(
					date,
					pressureAvg,
					pressureDelta,
					humidityAvg,
					getOrNull(dailyTempMin, i),
					getOrNull(dailyTempMax, i),
					getOrNull(dailyWindGusts, i)
			));
		}

		return result;
	}

	@Override
	public GeocodingResult reverseGeocode(double latitude, double longitude) {
		String url = REVERSE_GEOCODE_BASE
				+ "?format=json"
				+ "&lat=" + latitude
				+ "&lon=" + longitude
				+ "&accept-language=ru"
				+ "&zoom=10";

		JsonNode root;
		try {
			root = http.get().uri(URI.create(url)).retrieve().body(JsonNode.class);
		} catch (Exception e) {
			log.warn("Nominatim reverse не отвечает: {}", e.getMessage());
			return null;
		}
		if (root == null || root.isMissingNode()) return null;

		JsonNode addr = root.path("address");
		String name = firstNonEmpty(
				addr.path("city").asText(null),
				addr.path("town").asText(null),
				addr.path("village").asText(null),
				addr.path("hamlet").asText(null),
				addr.path("municipality").asText(null),
				addr.path("county").asText(null),
				root.path("name").asText(null)
		);
		String admin = firstNonEmpty(
				addr.path("state").asText(null),
				addr.path("region").asText(null)
		);
		String country = addr.path("country").asText(null);

		if (name == null && country == null) return null;
		return new GeocodingResult(
				name != null ? name : "Моё местоположение",
				admin,
				country,
				latitude,
				longitude
		);
	}

	@Override
	public List<GeocodingResult> geocode(String query, int limit) {
		String encoded = java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8);
		String url = GEOCODE_BASE
				+ "?name=" + encoded
				+ "&count=" + Math.max(1, Math.min(limit, 10))
				+ "&language=ru&format=json";

		log.info("Geocode query='{}' (encoded='{}')", query, encoded);

		JsonNode root;
		try {
			root = http.get().uri(URI.create(url)).retrieve().body(JsonNode.class);
		} catch (Exception e) {
			log.warn("Open-Meteo geocoding не отвечает: {}", e.getMessage());
			return Collections.emptyList();
		}
		if (root == null) return Collections.emptyList();

		JsonNode results = root.path("results");
		if (!results.isArray()) {
			log.info("Geocode: Open-Meteo не вернул results, raw={}", root);
			return Collections.emptyList();
		}

		List<GeocodingResult> list = new ArrayList<>();
		for (JsonNode r : results) {
			list.add(new GeocodingResult(
					r.path("name").asText(null),
					r.path("admin1").asText(null),
					r.path("country").asText(null),
					r.path("latitude").asDouble(),
					r.path("longitude").asDouble()
			));
		}
		log.info("Geocode: вернул {} результатов для '{}'", list.size(), query);
		return list;
	}

	// ── helpers ──

	private static Double averageForDay(List<String> times, List<Double> values, LocalDate date) {
		if (times.isEmpty() || values.isEmpty()) return null;
		double sum = 0;
		int n = 0;
		String prefix = date.toString(); // ISO: "2026-05-24"
		for (int i = 0; i < Math.min(times.size(), values.size()); i++) {
			if (times.get(i) != null && times.get(i).startsWith(prefix) && values.get(i) != null) {
				sum += values.get(i);
				n++;
			}
		}
		return n > 0 ? sum / n : null;
	}

	private static Double deltaVsPreviousDay(List<String> times, List<Double> values,
											 LocalDate date, double todayAvg) {
		Double prev = averageForDay(times, values, date.minusDays(1));
		return prev == null ? null : todayAvg - prev;
	}

	private static List<String> readStringArray(JsonNode node) {
		if (!node.isArray()) return Collections.emptyList();
		List<String> out = new ArrayList<>(node.size());
		for (JsonNode n : node) out.add(n.isNull() ? null : n.asText());
		return out;
	}

	private static List<Double> readDoubleArray(JsonNode node) {
		if (!node.isArray()) return Collections.emptyList();
		List<Double> out = new ArrayList<>(node.size());
		for (JsonNode n : node) out.add(n.isNull() ? null : n.asDouble());
		return out;
	}

	private static Double getOrNull(List<Double> list, int i) {
		return (i >= 0 && i < list.size()) ? list.get(i) : null;
	}

	private static String firstNonEmpty(String... values) {
		for (String v : values) {
			if (v != null && !v.isBlank() && !"null".equalsIgnoreCase(v)) return v;
		}
		return null;
	}
}
