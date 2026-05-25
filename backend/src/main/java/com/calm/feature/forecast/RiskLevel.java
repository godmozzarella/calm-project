package com.calm.feature.forecast;

/** Уровень риска головной боли по погодным условиям дня. */
public enum RiskLevel {
	LOW, MEDIUM, HIGH;

	/** Численный ранг: чем выше, тем тяжелее. Используется для порогов в SystemSettings. */
	public int rank() {
		return switch (this) {
			case LOW -> 0;
			case MEDIUM -> 1;
			case HIGH -> 2;
		};
	}

	public static RiskLevel fromKey(String key) {
		if (key == null) return MEDIUM;
		return switch (key.trim().toLowerCase()) {
			case "low" -> LOW;
			case "high" -> HIGH;
			default -> MEDIUM;
		};
	}
}
