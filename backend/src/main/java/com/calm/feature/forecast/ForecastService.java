package com.calm.feature.forecast;

import com.calm.feature.forecast.dto.ForecastDayDto;
import com.calm.feature.forecast.dto.ForecastResponse;
import com.calm.feature.forecast.provider.GeocodingResult;
import com.calm.feature.forecast.provider.NoaaKpService;
import com.calm.feature.forecast.provider.RawForecastDay;
import com.calm.feature.forecast.provider.WeatherProvider;
import com.calm.feature.forecast.provider.WeatherProviderRegistry;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Сердце фичи прогноза. Тянет «сырые» данные через активный {@link WeatherProvider},
 * считает риск-скор для каждого дня и кэширует результат на час по координатам
 * (защита от спама API).
 *
 * <h3>Логика риска</h3>
 * Балл = сумма штрафов по факторам (всего из 100):
 * <ul>
 *   <li><b>Δ давления за 24ч</b> (до 60 баллов): резкое падение ≥10 hPa → +60, ≥7 → +45,
 *       ≥5 → +30, ≥3 → +15. Резкий рост тоже учитывается, но мягче (×0.6).</li>
 *   <li><b>Высокая влажность</b> (до 20): &gt;85% → +20, &gt;75% → +10.</li>
 *   <li><b>Размах температуры за день</b> (до 20): &gt;15°C → +20, &gt;10°C → +10.</li>
 * </ul>
 * Уровни: ≥55 — HIGH, ≥30 — MEDIUM, иначе LOW.
 *
 * <p>Эти пороги выбраны эмпирически по обзорным статьям про barometric-trigger migraine.
 * Когда появится своя статистика приступов пользователя, можно будет калибровать
 * персонально — но это уже фаза 3.
 */
@Service
public class ForecastService {

	private static final Duration CACHE_TTL = Duration.ofHours(1);
	private static final int DEFAULT_DAYS_AHEAD = 3;

	private final WeatherProviderRegistry providers;
	private final NoaaKpService noaaKpService;
	private final Map<String, CachedResponse> cache = new ConcurrentHashMap<>();

	public ForecastService(WeatherProviderRegistry providers, NoaaKpService noaaKpService) {
		this.providers = providers;
		this.noaaKpService = noaaKpService;
	}

	public ForecastResponse getForecast(double lat, double lon) {
		String key = cacheKey(lat, lon);
		CachedResponse cached = cache.get(key);
		if (cached != null && cached.isFresh()) {
			return cached.response;
		}

		WeatherProvider provider = providers.active();
		List<RawForecastDay> raw = provider.fetchForecast(lat, lon, DEFAULT_DAYS_AHEAD);

		Map<LocalDate, Double> kpByDate = noaaKpService.getDailyMaxKp();
		List<RawForecastDay> enriched = raw.stream()
				.map(r -> kpByDate.containsKey(r.date()) ? r.withKpIndex(kpByDate.get(r.date())) : r)
				.toList();

		List<ForecastDayDto> days = enriched.stream().map(ForecastService::toDayDto).toList();

		ForecastResponse response = new ForecastResponse(provider.getKey(), days);
		cache.put(key, new CachedResponse(response, Instant.now()));
		return response;
	}

	public List<GeocodingResult> geocode(String query, int limit) {
		return providers.active().geocode(query, limit);
	}

	public GeocodingResult reverseGeocode(double lat, double lon) {
		return providers.active().reverseGeocode(lat, lon);
	}

	/** Видимая методам пакета — для использования планировщиком уведомлений. */
	List<ForecastDayDto> rawDays(double lat, double lon) {
		return getForecast(lat, lon).days();
	}

	// ── core scoring ──

	static ForecastDayDto toDayDto(RawForecastDay r) {
		int score = 0;
		List<String> reasons = new ArrayList<>();

		// 1. Δ давления — самый важный фактор
		if (r.pressureDelta24h() != null) {
			double delta = r.pressureDelta24h();
			double abs = Math.abs(delta);
			boolean isDrop = delta < 0; // падение опаснее роста
			double weight = isDrop ? 1.0 : 0.6;

			int pressurePenalty;
			if (abs >= 10) pressurePenalty = 60;
			else if (abs >= 7) pressurePenalty = 45;
			else if (abs >= 5) pressurePenalty = 30;
			else if (abs >= 3) pressurePenalty = 15;
			else pressurePenalty = 0;

			pressurePenalty = (int) Math.round(pressurePenalty * weight);
			score += pressurePenalty;

			if (pressurePenalty > 0) {
				reasons.add(String.format("%s давления %s%.0f hPa за сутки",
						isDrop ? "Падение" : "Рост", isDrop ? "" : "+", abs));
			}
		}

		// 2. Влажность
		if (r.humidityAvg() != null) {
			double h = r.humidityAvg();
			if (h > 85) {
				score += 20;
				reasons.add(String.format("Очень высокая влажность (%.0f%%)", h));
			} else if (h > 75) {
				score += 10;
				reasons.add(String.format("Повышенная влажность (%.0f%%)", h));
			}
		}

		// 3. Размах температуры
		if (r.tempMin() != null && r.tempMax() != null) {
			double range = r.tempMax() - r.tempMin();
			if (range > 15) {
				score += 20;
				reasons.add(String.format("Сильный перепад температуры (%.0f°C за день)", range));
			} else if (range > 10) {
				score += 10;
				reasons.add(String.format("Перепад температуры (%.0f°C за день)", range));
			}
		}

		// 4. Геомагнитная активность (NOAA SWPC Kp-индекс)
		if (r.kpIndex() != null) {
			double kp = r.kpIndex();
			if (kp >= 7) {
				score += 25;
				reasons.add(String.format("Геомагнитная буря (Kp %.0f)", kp));
			} else if (kp >= 5) {
				score += 15;
				reasons.add(String.format("Повышенная геомагнитная активность (Kp %.0f)", kp));
			} else if (kp >= 4) {
				score += 10;
				reasons.add(String.format("Умеренная геомагнитная активность (Kp %.0f)", kp));
			}
		}

		score = Math.min(100, score);
		RiskLevel level = score >= 55 ? RiskLevel.HIGH
				: score >= 30 ? RiskLevel.MEDIUM
				: RiskLevel.LOW;

		return new ForecastDayDto(
				r.date(),
				level,
				score,
				reasons,
				roundOrNull(r.pressureHpaAvg(), 0),
				roundOrNull(r.pressureDelta24h(), 1),
				roundOrNull(r.humidityAvg(), 0),
				roundOrNull(r.tempMin(), 0),
				roundOrNull(r.tempMax(), 0),
				roundOrNull(r.windKmhMax(), 0),
				roundOrNull(r.kpIndex(), 1)
		);
	}

	private static Double roundOrNull(Double value, int digits) {
		if (value == null) return null;
		double scale = Math.pow(10, digits);
		return Math.round(value * scale) / scale;
	}

	private static String cacheKey(double lat, double lon) {
		// Координаты округляем до 2 знаков (~1 км), чтобы соседние юзеры шарили кэш.
		return String.format("%.2f,%.2f", lat, lon);
	}

	private record CachedResponse(ForecastResponse response, Instant at) {
		boolean isFresh() {
			return Duration.between(at, Instant.now()).compareTo(CACHE_TTL) < 0;
		}
	}
}
