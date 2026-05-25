package com.calm.feature.forecast.provider;

import com.calm.feature.settings.SystemSettingsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Собирает все Spring-бины {@link WeatherProvider} по их ключу и отдаёт
 * активного — того, чей key совпадает с {@code SystemSettings.weather.activeProvider}.
 *
 * <p>Когда в админке поменяется активный провайдер, сюда никаких правок не надо:
 * на следующем запросе {@link #active()} прочитает обновлённый документ настроек
 * и вернёт другую реализацию.
 */
@Component
public class WeatherProviderRegistry {

	private static final Logger log = LoggerFactory.getLogger(WeatherProviderRegistry.class);

	private final Map<String, WeatherProvider> byKey;
	private final SystemSettingsService settings;

	public WeatherProviderRegistry(List<WeatherProvider> providers, SystemSettingsService settings) {
		this.byKey = providers.stream().collect(Collectors.toUnmodifiableMap(WeatherProvider::getKey, Function.identity()));
		this.settings = settings;
		log.info("Зарегистрированы погодные провайдеры: {}", byKey.keySet());
	}

	/** Активный провайдер согласно {@code SystemSettings}. */
	public WeatherProvider active() {
		String key = settings.get().getWeather().getActiveProvider();
		WeatherProvider p = byKey.get(key);
		if (p == null) {
			throw new IllegalStateException(
					"Активный погодный провайдер '" + key + "' не зарегистрирован. Доступные: " + byKey.keySet());
		}
		return p;
	}

	/** Все доступные ключи — для будущей админки. */
	public List<String> availableKeys() {
		return List.copyOf(byKey.keySet());
	}
}
