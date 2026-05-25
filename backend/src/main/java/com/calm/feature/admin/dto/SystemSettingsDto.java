package com.calm.feature.admin.dto;

import com.calm.feature.settings.SystemSettings;

import java.util.List;
import java.util.Map;

/**
 * DTO для админ-панели. {@code availableProviders} — это ключи всех зарегистрированных
 * погодных провайдеров (для выпадашки на фронте), формируется сервером.
 */
public record SystemSettingsDto(
		String activeProvider,
		List<String> availableProviders,
		Map<String, String> apiKeys,
		int morningHour,
		String riskThreshold
) {
	public static SystemSettingsDto from(SystemSettings s, List<String> providers) {
		return new SystemSettingsDto(
				s.getWeather().getActiveProvider(),
				providers,
				Map.copyOf(s.getWeather().getApiKeys()),
				s.getNotifications().getMorningHour(),
				s.getNotifications().getRiskThreshold()
		);
	}
}
