package com.calm.feature.settings;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Доступ к глобальным настройкам системы. Документ всегда один.
 * Инициализирует дефолты при первом запуске. В будущем именно этот сервис
 * будет дёргать админ-панель для обновления провайдера погоды и порогов.
 */
@Service
public class SystemSettingsService {

	private static final Logger log = LoggerFactory.getLogger(SystemSettingsService.class);

	private final SystemSettingsRepository repo;

	public SystemSettingsService(SystemSettingsRepository repo) {
		this.repo = repo;
	}

	@PostConstruct
	void bootstrap() {
		if (!repo.existsById(SystemSettings.SINGLETON_ID)) {
			SystemSettings defaults = new SystemSettings();
			repo.save(defaults);
			log.info("Инициализированы дефолтные SystemSettings (активный погодный провайдер: {})",
					defaults.getWeather().getActiveProvider());
		}
	}

	public SystemSettings get() {
		return repo.findById(SystemSettings.SINGLETON_ID)
				.orElseGet(() -> repo.save(new SystemSettings()));
	}

	public SystemSettings save(SystemSettings settings) {
		settings.setId(SystemSettings.SINGLETON_ID);
		return repo.save(settings);
	}
}
