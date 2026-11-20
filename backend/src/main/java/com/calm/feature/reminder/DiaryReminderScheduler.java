package com.calm.feature.reminder;

import com.calm.feature.attack.Attack;
import com.calm.feature.attack.AttackRepository;
import com.calm.feature.email.EmailService;
import com.calm.feature.push.BrowserPushService;
import com.calm.feature.push.BrowserPushService.Message;
import com.calm.feature.push.DevicePushSubscriptions;
import com.calm.feature.questionnaire.DailyQuestionnaire;
import com.calm.feature.questionnaire.QuestionnaireRepository;
import com.calm.feature.risk.AccountDeletedEvent;
import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.function.BooleanSupplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

@Component
public class DiaryReminderScheduler {
	private static final Logger log = LoggerFactory.getLogger(DiaryReminderScheduler.class);
	private static final int BATCH_SIZE = 200;
	private static final Duration ATTACK_INTERVAL = Duration.ofHours(2);
	private static final Duration ATTEMPT_RETENTION = Duration.ofDays(3);
	private static final Message CARDS = new Message("Ежедневные карточки Calm",
			"Зайдите в Calm и ответьте на сегодняшние карточки.", "/profile?reminder=cards", "calm-cards-reminder");

	private final AttackRepository attacks;
	private final QuestionnaireRepository questionnaires;
	private final UserRepository users;
	private final DevicePushSubscriptions subscriptions;
	private final BrowserPushService push;
	private final EmailService mail;
	private final MongoTemplate mongo;
	private final ZoneId defaultZone;
	private final String publicUrl;

	public DiaryReminderScheduler(AttackRepository attacks, QuestionnaireRepository questionnaires,
			UserRepository users, DevicePushSubscriptions subscriptions, BrowserPushService push, EmailService mail,
			MongoTemplate mongo, @Value("${calm.notifications.zone:Europe/Moscow}") String defaultZone,
			@Value("${calm.public-url}") String publicUrl) {
		this.attacks = attacks;
		this.questionnaires = questionnaires;
		this.users = users;
		this.subscriptions = subscriptions;
		this.push = push;
		this.mail = mail;
		this.mongo = mongo;
		this.defaultZone = ZoneId.of(defaultZone);
		this.publicUrl = publicUrl.replaceAll("/+$", "");
	}

	@Scheduled(cron = "${calm.reminders.cron:0 * * * * *}")
	public void dispatch() {
		dispatchAt(Instant.now());
	}

	void dispatchAt(Instant now) {
		sendAttackReminders(now);
		sendMorningReminders(now);
	}

	private void sendAttackReminders(Instant now) {
		for (int page = 0; !Thread.currentThread().isInterrupted(); page++) {
			List<Attack> batch = attacks.findByOngoingTrue(page(page));
			for (Attack attack : batch) {
				safely(() -> users.findById(attack.getUserId()).ifPresent(user -> remindAboutAttack(attack, user, now)));
			}
			if (batch.size() < BATCH_SIZE) return;
		}
	}

	private void remindAboutAttack(Attack attack, User user, Instant now) {
		Instant start = attackStart(attack, user);
		long period = attackPeriod(start, now);
		if (period < 1) return;

		String key = "attack:" + attack.getId() + ":" + start.getEpochSecond() + ":" + period;
		Message message = new Message("Напоминание от Calm",
				"Приступ закончился? Если да, отметьте его завершение в дневнике Calm.",
				"/profile?reminder=attack", "calm-attack-reminder-" + attack.getId());
		deliver(user, key, message, now, () -> attacks.findById(attack.getId())
				.filter(Attack::isOngoing).map(item -> attackStart(item, user)).filter(start::equals).isPresent());
	}

	private void sendMorningReminders(Instant now) {
		var checked = new HashSet<String>();
		for (int page = 0; !Thread.currentThread().isInterrupted(); page++) {
			List<User> batch = users.findByEmailVerifiedTrueAndNotificationsEnabledTrue(page(page));
			for (User user : batch) {
				checked.add(user.getId());
				safely(() -> remindAboutCards(user, now));
			}
			if (batch.size() < BATCH_SIZE) break;
		}
		if (!push.available()) return;

		String cursor = null;
		for (var batch = subscriptions.batchAfter(cursor); !batch.isEmpty(); batch = subscriptions.batchAfter(cursor)) {
			for (var subscription : batch) {
				if (Thread.currentThread().isInterrupted()) return;
				cursor = subscription.id();
				if (checked.add(subscription.userId())) {
					safely(() -> users.findById(subscription.userId()).ifPresent(user -> remindAboutCards(user, now)));
				}
			}
		}
	}

	private void remindAboutCards(User user, Instant now) {
		LocalDate date = morningDate(now, userZone(user));
		if (date == null) return;
		String questionnaireId = DailyQuestionnaire.key(user.getId(), date);
		if (questionnaires.existsById(questionnaireId)) return;
		deliver(user, "cards:" + date, CARDS, now, () -> !questionnaires.existsById(questionnaireId));
	}

	private void deliver(User user, String key, Message message, Instant now, BooleanSupplier stillDue) {
		if (user.isEmailVerified() && user.isNotificationsEnabled()) {
			safely(() -> {
				if (!claim(user.getId(), key, "email", now) || !stillDue.getAsBoolean()) return;
				String link = publicUrl + message.path();
				String html = "<p>" + HtmlUtils.htmlEscape(message.body()) + "</p><p><a href=\""
						+ HtmlUtils.htmlEscape(link) + "\">Открыть Calm</a></p>";
				mail.send(user.getEmail(), message.title(), html, message.body() + "\n\nОткрыть Calm: " + link);
			});
		}
		if (!push.available()) return;
		for (var device : subscriptions.forUser(user.getId())) {
			safely(() -> {
				if (!claim(user.getId(), key, device.id(), now) || !stillDue.getAsBoolean()) return;
				if (push.send(device, message) == BrowserPushService.Delivery.EXPIRED) subscriptions.remove(device);
			});
		}
	}

	private boolean claim(String userId, String key, String channel, Instant now) {
		try {
			mongo.insert(new ReminderAttempt(userId + ":" + key + ":" + channel,
					userId, now.plus(ATTEMPT_RETENTION)));
			return true;
		} catch (DuplicateKeyException e) {
			return false;
		}
	}

	@EventListener
	public void onAccountDeleted(AccountDeletedEvent event) {
		mongo.remove(Query.query(Criteria.where("userId").is(event.userId())), ReminderAttempt.class);
	}

	static long attackPeriod(Instant start, Instant now) {
		return start == null || now.isBefore(start) ? 0 : Duration.between(start, now).dividedBy(ATTACK_INTERVAL);
	}

	static LocalDate morningDate(Instant now, ZoneId zone) {
		ZonedDateTime local = now.atZone(zone);
		return local.getHour() == 8 && local.getMinute() < 10 ? local.toLocalDate() : null;
	}

	Instant attackStart(Attack attack, User user) {
		if (attack.getStartDate() == null || attack.getStartTime() == null) return null;
		ZoneId zone = userZone(user);
		if (attack.getEventLocation() != null) zone = zoneOr(attack.getEventLocation().timezone(), zone);
		zone = zoneOr(attack.getReminderStartTimezone(), zone);
		return attack.getStartDate().atTime(attack.getStartTime()).atZone(zone).toInstant();
	}

	private ZoneId userZone(User user) {
		return user.hasLocationTimezone() ? zoneOr(user.getLocationTimezone(), defaultZone) : defaultZone;
	}

	private static ZoneId zoneOr(String value, ZoneId fallback) {
		if (value == null || value.isBlank()) return fallback;
		try {
			return ZoneId.of(value);
		} catch (DateTimeException e) {
			return fallback;
		}
	}

	private static PageRequest page(int page) {
		return PageRequest.of(page, BATCH_SIZE, Sort.by("_id"));
	}

	private static void safely(Runnable dispatch) {
		try {
			dispatch.run();
		} catch (RuntimeException e) {
			log.warn("Не удалось обработать напоминание ({})", e.getClass().getSimpleName());
		}
	}
}
