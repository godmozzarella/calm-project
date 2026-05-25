package com.calm.feature.settings;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.HashMap;
import java.util.Map;

/**
 * Единый документ глобальных настроек системы. id всегда {@link #SINGLETON_ID}.
 * Меняется только администратором (когда появится админка). Сейчас правится через
 * перезапись документа напрямую или через bootstrap-инициализацию дефолтов.
 */
@Document(collection = "system_settings")
public class SystemSettings {

	public static final String SINGLETON_ID = "global";

	@Id
	private String id = SINGLETON_ID;

	private WeatherSettings weather = new WeatherSettings();
	private NotificationSettings notifications = new NotificationSettings();

	public String getId() { return id; }
	public void setId(String id) { this.id = id; }

	public WeatherSettings getWeather() { return weather; }
	public void setWeather(WeatherSettings weather) { this.weather = weather; }

	public NotificationSettings getNotifications() { return notifications; }
	public void setNotifications(NotificationSettings notifications) { this.notifications = notifications; }

	/** Настройки активного поставщика данных о погоде. */
	public static class WeatherSettings {
		/** Ключ активного провайдера. Совпадает с {@code WeatherProvider.getKey()}. */
		private String activeProvider = "openmeteo";
		/** Ключи API по провайдерам (там, где они нужны). */
		private Map<String, String> apiKeys = new HashMap<>();

		public String getActiveProvider() { return activeProvider; }
		public void setActiveProvider(String activeProvider) { this.activeProvider = activeProvider; }

		public Map<String, String> getApiKeys() { return apiKeys; }
		public void setApiKeys(Map<String, String> apiKeys) { this.apiKeys = apiKeys; }
	}

	/** Настройки рассылки погодных уведомлений. */
	public static class NotificationSettings {
		/** Локальный час, в который запускается утренняя рассылка (0–23). */
		private int morningHour = 8;
		/** Минимальный уровень риска, при котором шлём письмо: low | medium | high. */
		private String riskThreshold = "medium";

		public int getMorningHour() { return morningHour; }
		public void setMorningHour(int morningHour) { this.morningHour = morningHour; }

		public String getRiskThreshold() { return riskThreshold; }
		public void setRiskThreshold(String riskThreshold) { this.riskThreshold = riskThreshold; }
	}
}
