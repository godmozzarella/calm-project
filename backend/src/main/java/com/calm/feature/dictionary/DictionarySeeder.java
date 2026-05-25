package com.calm.feature.dictionary;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * При первом старте засеивает справочники симптомов и триггеров дефолтными значениями.
 * Если коллекция уже не пустая — ничего не делает. Это позволяет переопределять
 * наборы через UI админа, не получая «отката» при следующем запуске.
 */
@Component
public class DictionarySeeder {

	private static final Logger log = LoggerFactory.getLogger(DictionarySeeder.class);

	private final DictionaryRepository repo;

	public DictionarySeeder(DictionaryRepository repo) {
		this.repo = repo;
	}

	@EventListener(ApplicationReadyEvent.class)
	public void seed() {
		seedType(DictionaryType.SYMPTOM, List.of(
				entry("nausea",    "Тошнота"),
				entry("light",     "Светобоязнь"),
				entry("sound",     "Звукобоязнь"),
				entry("aura",      "Аура"),
				entry("dizziness", "Головокружение")
		));

		seedType(DictionaryType.TRIGGER, List.of(
				entry("stress",   "Стресс"),
				entry("sleep",    "Сон"),
				entry("food",     "Еда"),
				entry("weather",  "Погода"),
				entry("screen",   "Экран"),
				entry("hormones", "Гормоны"),
				entry("alcohol",  "Алкоголь")
		));
	}

	private void seedType(DictionaryType type, List<SeedEntry> entries) {
		if (repo.countByType(type) > 0) return;
		int order = 10;
		for (SeedEntry e : entries) {
			repo.save(new DictionaryEntry(type, e.value, e.label, order));
			order += 10;
		}
		log.info("Справочник {}: засеяно {} записей", type, entries.size());
	}

	private static SeedEntry entry(String value, String label) {
		return new SeedEntry(value, label);
	}

	private record SeedEntry(String value, String label) {}
}
