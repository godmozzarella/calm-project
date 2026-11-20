package com.calm.feature.forecast.notification;

import com.calm.feature.forecast.ForecastService;
import com.calm.feature.forecast.RiskLevel;
import com.calm.feature.push.BrowserPushService;
import com.calm.feature.push.DevicePushSubscription;
import com.calm.feature.push.DevicePushSubscriptions;
import com.calm.feature.settings.SystemSettingsService;
import com.calm.feature.user.UserRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ForecastPushScheduler {
	private static final Logger log = LoggerFactory.getLogger(ForecastPushScheduler.class);
	private final DevicePushSubscriptions subscriptions;
	private final BrowserPushService push;
	private final UserRepository users;
	private final ForecastService forecast;
	private final SystemSettingsService settings;
	private final ZoneId zone;

	public ForecastPushScheduler(DevicePushSubscriptions subscriptions, BrowserPushService push, UserRepository users,
			ForecastService forecast, SystemSettingsService settings,
			@Value("${calm.notifications.zone:Europe/Moscow}") String zone) {
		this.subscriptions = subscriptions;
		this.push = push;
		this.users = users;
		this.forecast = forecast;
		this.settings = settings;
		this.zone = ZoneId.of(zone);
	}

	@Scheduled(cron = "${calm.notifications.cron:0 0 8 * * *}", zone = "${calm.notifications.zone:Europe/Moscow}")
	public void dispatch() {
		if (!push.available()) return;
		LocalDate today = LocalDate.now(zone);
		RiskLevel threshold = RiskLevel.fromKey(settings.get().getNotifications().getRiskThreshold());
		String cursor = null;
		for (var batch = subscriptions.batchAfter(cursor); !batch.isEmpty(); batch = subscriptions.batchAfter(cursor)) {
			var eligible = new HashMap<String, Boolean>();
			for (DevicePushSubscription subscription : batch) {
				if (Thread.currentThread().isInterrupted()) return;
				cursor = subscription.id();
				if (today.equals(subscription.lastDispatchDate())) continue;
				try {
					if (!eligible.computeIfAbsent(subscription.userId(), id -> forecastMatches(id, threshold))) continue;
					if (!subscriptions.claim(subscription, today)) continue;
					switch (push.sendForecast(subscription)) {
						case EXPIRED -> subscriptions.remove(subscription);
						case FAILED -> subscriptions.release(subscription, today);
						case SENT -> { /* The dispatch date was already recorded. */ }
					}
				} catch (RuntimeException e) {
					log.warn("Не удалось обработать подписку на прогноз ({})", e.getClass().getSimpleName());
				}
			}
		}
	}

	private boolean forecastMatches(String userId, RiskLevel threshold) {
		return users.findById(userId)
				.filter(user -> user.getLatitude() != null && user.getLongitude() != null)
				.map(user -> forecast.getForecast(user.getLatitude(), user.getLongitude()).days())
				.filter(days -> !days.isEmpty())
				.map(days -> days.getFirst().risk().rank() >= threshold.rank())
				.orElse(false);
	}
}
