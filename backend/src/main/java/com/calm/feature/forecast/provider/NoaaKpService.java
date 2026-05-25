package com.calm.feature.forecast.provider;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Тянет глобальный Kp-индекс геомагнитной активности из NOAA SWPC.
 * Эндпоинт публичный, без авторизации, обновляется каждые ~3 ч.
 *
 * <p>Кэш живёт 3 часа — достаточно для прогноза, не спамим NOAA.
 *
 * <p>Формат ответа NOAA (массив объектов):
 * {@code [{"time_tag":"2026-05-25T00:00:00","kp":2.33,"observed":"predicted",...}, ...]}
 */
@Service
public class NoaaKpService {

	private static final Logger log = LoggerFactory.getLogger(NoaaKpService.class);
	private static final String KP_URL =
			"https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json";
	private static final Duration CACHE_TTL = Duration.ofHours(3);

	private final RestClient http = RestClient.builder().baseUrl(KP_URL).build();

	private volatile Map<LocalDate, Double> cachedKp = Map.of();
	private volatile Instant cachedAt = Instant.EPOCH;

	/** Возвращает максимальный Kp за сутки по UTC-дате. Никогда не бросает — при ошибке даёт пустую карту. */
	public Map<LocalDate, Double> getDailyMaxKp() {
		if (Duration.between(cachedAt, Instant.now()).compareTo(CACHE_TTL) < 0) {
			return cachedKp;
		}
		try {
			// Ответ: [{"time_tag":"2026-05-25T00:00:00","kp":2.33,"observed":"predicted",...}, ...]
			List<Map<String, Object>> rows = http.get()
					.retrieve()
					.body(new org.springframework.core.ParameterizedTypeReference<>() {});

			if (rows == null || rows.isEmpty()) {
				log.warn("NOAA SWPC: пустой ответ");
				return cachedKp;
			}

			Map<LocalDate, Double> result = new HashMap<>();
			for (Map<String, Object> row : rows) {
				try {
					String timeTag = (String) row.get("time_tag");
					Object kpRaw = row.get("kp");
					if (timeTag == null || kpRaw == null) continue;
					LocalDate date = LocalDate.parse(timeTag.substring(0, 10));
					double kp = ((Number) kpRaw).doubleValue();
					result.merge(date, kp, Math::max);
				} catch (Exception ignored) {
					// пропускаем строку с неожиданным форматом
				}
			}

			cachedKp = Map.copyOf(result);
			cachedAt = Instant.now();
			log.debug("NOAA SWPC: загружено {} дней Kp-данных", result.size());
		} catch (RestClientException e) {
			log.warn("NOAA SWPC: не удалось загрузить Kp-индексы — {}", e.getMessage());
		}
		return cachedKp;
	}
}
