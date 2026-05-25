package com.calm.feature.forecast;

import com.calm.feature.forecast.dto.ForecastResponse;
import com.calm.feature.forecast.dto.GeocodingDto;
import com.calm.feature.forecast.notification.ForecastNotificationScheduler;
import com.calm.feature.user.UserService;
import com.calm.security.AuthenticatedUser;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Публичные эндпоинты прогноза. Доступны авторизованному пользователю.
 *
 * <ul>
 *   <li>{@code GET /forecast?lat=&lon=} — сегодня + 3 дня с риск-скором</li>
 *   <li>{@code GET /forecast/geocode?q=Москва} — поиск города для онбординга</li>
 * </ul>
 */
@RestController
@RequestMapping("/forecast")
@Validated
public class ForecastController {

	private final ForecastService service;
	private final ForecastNotificationScheduler scheduler;
	private final UserService userService;

	public ForecastController(
			ForecastService service,
			ForecastNotificationScheduler scheduler,
			UserService userService
	) {
		this.service = service;
		this.scheduler = scheduler;
		this.userService = userService;
	}

	@GetMapping
	public ForecastResponse forecast(
			@RequestParam double lat,
			@RequestParam double lon
	) {
		return service.getForecast(lat, lon);
	}

	@GetMapping("/geocode")
	public List<GeocodingDto> geocode(
			@RequestParam("q") @NotBlank @Size(min = 1, max = 100) String query,
			@RequestParam(defaultValue = "5") int limit
	) {
		return service.geocode(query, limit).stream().map(GeocodingDto::from).toList();
	}

	@GetMapping("/reverse-geocode")
	public GeocodingDto reverseGeocode(
			@RequestParam double lat,
			@RequestParam double lon
	) {
		var r = service.reverseGeocode(lat, lon);
		return r != null ? GeocodingDto.from(r) : null;
	}

	/**
	 * Принудительная отправка тестового письма себе. Игнорирует порог риска
	 * и проверку «уже слали сегодня» — нужно для проверки SMTP-настроек и шаблона.
	 */
	@PostMapping("/notify-test")
	public Map<String, String> notifyTest(@AuthenticationPrincipal AuthenticatedUser principal) {
		var user = userService.getById(principal.getUserId());
		String message = scheduler.sendTestToUser(user);
		return Map.of("message", message);
	}
}
