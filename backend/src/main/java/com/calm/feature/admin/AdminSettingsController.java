package com.calm.feature.admin;

import com.calm.common.exception.ConflictException;
import com.calm.feature.admin.dto.SystemSettingsDto;
import com.calm.feature.admin.dto.UpdateSystemSettingsRequest;
import com.calm.feature.forecast.provider.WeatherProviderRegistry;
import com.calm.feature.settings.SystemSettings;
import com.calm.feature.settings.SystemSettingsService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/settings")
public class AdminSettingsController {

	private final SystemSettingsService settingsService;
	private final WeatherProviderRegistry providerRegistry;

	public AdminSettingsController(SystemSettingsService settingsService,
			WeatherProviderRegistry providerRegistry) {
		this.settingsService = settingsService;
		this.providerRegistry = providerRegistry;
	}

	@GetMapping
	public SystemSettingsDto get() {
		return SystemSettingsDto.from(settingsService.get(), providerRegistry.availableKeys());
	}

	@PatchMapping
	public SystemSettingsDto update(@Valid @RequestBody UpdateSystemSettingsRequest req) {
		SystemSettings current = settingsService.get();

		if (req.activeProvider() != null) {
			if (!providerRegistry.availableKeys().contains(req.activeProvider())) {
				throw new ConflictException("Провайдер '" + req.activeProvider()
						+ "' не зарегистрирован. Доступные: " + providerRegistry.availableKeys());
			}
			current.getWeather().setActiveProvider(req.activeProvider());
		}
		if (req.apiKeys() != null) {
			current.getWeather().setApiKeys(req.apiKeys());
		}
		if (req.morningHour() != null) {
			current.getNotifications().setMorningHour(req.morningHour());
		}
		if (req.riskThreshold() != null) {
			current.getNotifications().setRiskThreshold(req.riskThreshold());
		}

		SystemSettings saved = settingsService.save(current);
		return SystemSettingsDto.from(saved, providerRegistry.availableKeys());
	}
}
