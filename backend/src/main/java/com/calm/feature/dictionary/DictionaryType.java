package com.calm.feature.dictionary;

/**
 * Типы справочников, которыми управляет админ.
 * Фронт получает список нужного типа через публичный {@code GET /dictionaries?type=...}.
 */
public enum DictionaryType {
	/** Симптомы приступа (тошнота, светобоязнь и т.д.). */
	SYMPTOM,
	/** Триггеры приступа (стресс, сон, погода и т.д.). */
	TRIGGER,
	/**
	 * Пресеты препаратов: value=машинное имя, label=видимое имя, category=терапевтический класс
	 * (triptan / nsaid / simple / opioid / preventive). Используется в MOH-метрике для определения
	 * лекарственно-индуцированной головной боли.
	 */
	MEDICATION_PRESET
}
