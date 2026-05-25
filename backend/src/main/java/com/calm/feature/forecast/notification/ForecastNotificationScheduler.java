package com.calm.feature.forecast.notification;

import com.calm.feature.email.EmailService;
import com.calm.feature.forecast.ForecastService;
import com.calm.feature.forecast.RiskLevel;
import com.calm.feature.forecast.dto.ForecastDayDto;
import com.calm.feature.forecast.dto.ForecastResponse;
import com.calm.feature.settings.SystemSettings;
import com.calm.feature.settings.SystemSettingsService;
import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Ежеутренняя рассылка погодных уведомлений. Запускается раз в день по cron
 * (по умолчанию — 08:00 МСК, задаётся в {@code calm.notifications.cron}).
 *
 * <p>Для каждого пользователя с настроенной локацией и включёнными уведомлениями:
 * <ol>
 *   <li>пропускаем если сегодня уже слали (по {@code lastNotifiedDate});</li>
 *   <li>тянем сегодняшний прогноз;</li>
 *   <li>если риск ≥ порога из {@code SystemSettings} — шлём письмо;</li>
 *   <li>отмечаем {@code lastNotifiedDate}, чтобы не задублировать при ретрае.</li>
 * </ol>
 *
 * <p>Реальная рассылка идёт только если email-провайдер сконфигурирован. Иначе {@link EmailService}
 * вернёт false и {@code lastNotifiedDate} не обновится — попробуем завтра.
 */
@Component
public class ForecastNotificationScheduler {

	private static final Logger log = LoggerFactory.getLogger(ForecastNotificationScheduler.class);

	private final UserRepository users;
	private final ForecastService forecast;
	private final EmailService email;
	private final ForecastEmailRenderer renderer;
	private final SystemSettingsService settings;

	public ForecastNotificationScheduler(
			UserRepository users,
			ForecastService forecast,
			EmailService email,
			ForecastEmailRenderer renderer,
			SystemSettingsService settings
	) {
		this.users = users;
		this.forecast = forecast;
		this.email = email;
		this.renderer = renderer;
		this.settings = settings;
	}

	@Scheduled(
			cron = "${calm.notifications.cron:0 0 8 * * *}",
			zone = "${calm.notifications.zone:Europe/Moscow}"
	)
	public void runMorningDispatch() {
		List<User> eligible = users.findEligibleForForecastEmails();
		if (eligible.isEmpty()) {
			log.info("Рассылка погодных уведомлений: подписчиков нет, пропускаем");
			return;
		}

		SystemSettings.NotificationSettings notif = settings.get().getNotifications();
		RiskLevel threshold = RiskLevel.fromKey(notif.getRiskThreshold());
		LocalDate today = LocalDate.now();

		int sent = 0, skippedLowRisk = 0, skippedAlready = 0, errors = 0;

		for (User u : eligible) {
			if (today.equals(u.getLastNotifiedDate())) {
				skippedAlready++;
				continue;
			}
			try {
				ForecastResponse fr = forecast.getForecast(u.getLatitude(), u.getLongitude());
				if (fr.days().isEmpty()) continue;

				ForecastDayDto todayForecast = fr.days().get(0);
				if (todayForecast.risk().rank() < threshold.rank()) {
					skippedLowRisk++;
					continue;
				}

				List<ForecastDayDto> upcoming = fr.days().size() > 1
						? fr.days().subList(1, fr.days().size())
						: List.of();

				String subject = renderer.renderSubject(todayForecast);
				String html = renderer.renderBody(u.getName(), u.getCity(), todayForecast, upcoming);

				if (email.send(u.getEmail(), subject, html)) {
					u.setLastNotifiedDate(today);
					users.save(u);
					sent++;
				}
			} catch (Exception e) {
				errors++;
				log.warn("Ошибка отправки прогноза пользователю {}: {}", u.getEmail(), e.getMessage());
			}
		}

		log.info("Рассылка погоды: отправлено={}, пропущено(низкий риск)={}, пропущено(уже сегодня)={}, ошибок={}",
				sent, skippedLowRisk, skippedAlready, errors);
	}

	/**
	 * Принудительная отправка одному пользователю — для тестирования email.
	 * Игнорирует порог риска и {@code lastNotifiedDate}, так что письмо уходит
	 * всегда (если email-провайдер сконфигурирован и у пользователя задана локация).
	 *
	 * @return сообщение для отображения в UI
	 */
	public String sendTestToUser(User u) {
		if (!u.canReceiveForecastEmails()) {
			return "Сначала укажи город и включи уведомления.";
		}

		ForecastResponse fr = forecast.getForecast(u.getLatitude(), u.getLongitude());
		if (fr.days().isEmpty()) {
			return "Прогноз сейчас недоступен. Попробуй позже.";
		}

		ForecastDayDto today = fr.days().get(0);
		List<ForecastDayDto> upcoming = fr.days().size() > 1
				? fr.days().subList(1, fr.days().size())
				: List.of();

		String subject = "[ТЕСТ] " + renderer.renderSubject(today);
		String html = renderer.renderBody(u.getName(), u.getCity(), today, upcoming);

		if (email.send(u.getEmail(), subject, html)) {
			return "Письмо отправлено на " + u.getEmail() + ". Проверь почту (возможно в «Спам»).";
		}
		return "Не удалось отправить. Проверь настройки email-провайдера в логах бэка.";
	}
}
