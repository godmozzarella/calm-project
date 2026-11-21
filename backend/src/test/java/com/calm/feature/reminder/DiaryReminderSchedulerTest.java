package com.calm.feature.reminder;

import com.calm.feature.attack.Attack;
import com.calm.feature.attack.AttackRepository;
import com.calm.feature.email.EmailService;
import com.calm.feature.push.BrowserPushService;
import com.calm.feature.push.DevicePushSubscription;
import com.calm.feature.push.DevicePushSubscriptions;
import com.calm.feature.questionnaire.QuestionnaireRepository;
import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DiaryReminderSchedulerTest {
	private final AttackRepository attacks = mock(AttackRepository.class);
	private final QuestionnaireRepository cards = mock(QuestionnaireRepository.class);
	private final UserRepository users = mock(UserRepository.class);
	private final DevicePushSubscriptions devices = mock(DevicePushSubscriptions.class);
	private final BrowserPushService push = mock(BrowserPushService.class);
	private final EmailService mail = mock(EmailService.class);
	private final MongoTemplate mongo = mock(MongoTemplate.class);
	private final DiaryReminderScheduler scheduler = new DiaryReminderScheduler(
			attacks, cards, users, devices, push, mail, mongo, "Europe/Moscow", "https://calm.example");
	private final User user = new User("diary@example.test", "Test", null);
	private final DevicePushSubscription device = new DevicePushSubscription("device", "user", "", "", "", null);

	@BeforeEach
	void setUp() {
		user.setId("user");
		user.setEmailVerified(true);
		when(users.findById("user")).thenReturn(Optional.of(user));
		when(users.findByEmailVerifiedTrueAndNotificationsEnabledTrue(any(Pageable.class)))
				.thenAnswer(ignored -> user.isNotificationsEnabled() ? List.of(user) : List.of());
		when(devices.batchAfter(isNull())).thenReturn(List.of(device));
		when(devices.batchAfter("device")).thenReturn(List.of());
		when(devices.forUser("user")).thenReturn(List.of(device));
		when(push.available()).thenReturn(true);
		var attempts = new HashSet<String>();
		when(mongo.insert(any(ReminderAttempt.class))).thenAnswer(invocation -> {
			ReminderAttempt attempt = invocation.getArgument(0);
			if (!attempts.add(attempt.id())) throw new DuplicateKeyException("already sent");
			return attempt;
		});
	}

	@Test
	void remindsTwoHoursAfterEntryWasAddedAndStopsAfterCompletion() {
		user.setNotificationsEnabled(true);
		var attack = new Attack();
		attack.setId("attack");
		attack.setUserId("user");
		attack.setOngoing(true);
		attack.setStartDate(LocalDate.of(2026, 11, 19));
		attack.setStartTime(LocalTime.of(7, 0));
		attack.setReminderStartTimezone("Europe/Moscow");
		attack.setCreatedAt(Instant.parse("2026-11-19T16:15:00Z"));
		when(attacks.findByOngoingTrue(any())).thenReturn(List.of(attack));
		when(attacks.findById("attack")).thenReturn(Optional.of(attack));

		scheduler.dispatchAt(Instant.parse("2026-11-19T16:15:00Z"));
		scheduler.dispatchAt(Instant.parse("2026-11-19T18:14:59Z"));
		verifyNoInteractions(mail);
		verify(push, never()).send(any(), any());

		scheduler.dispatchAt(Instant.parse("2026-11-19T18:15:00Z"));
		attack.setStartTime(LocalTime.of(6, 50));
		scheduler.dispatchAt(Instant.parse("2026-11-19T18:16:00Z"));
		scheduler.dispatchAt(Instant.parse("2026-11-19T20:15:00Z"));
		attack.setOngoing(false);
		scheduler.dispatchAt(Instant.parse("2026-11-19T22:15:00Z"));

		verify(mail, times(2)).send(eq(user.getEmail()), any(), contains("Приступ закончился?"), contains("reminder=attack"));
		verify(push, times(2)).send(eq(device), argThat(message -> message.path().equals("/profile?reminder=attack")));
	}

	@Test
	void legacyEntryUsesCreationTimeFromItsMongoId() {
		Instant addedAt = Instant.parse("2026-11-19T16:15:00Z");
		var attack = new Attack();
		attack.setId(new ObjectId(Date.from(addedAt)).toHexString());
		attack.setUserId("user");
		attack.setOngoing(true);
		when(attacks.findByOngoingTrue(any())).thenReturn(List.of(attack));
		when(attacks.findById(attack.getId())).thenReturn(Optional.of(attack));

		scheduler.dispatchAt(addedAt.plusSeconds(7_199));
		verify(push, never()).send(any(), any());
		scheduler.dispatchAt(addedAt.plusSeconds(7_200));
		verify(push).send(eq(device), argThat(message -> message.path().equals("/profile?reminder=attack")));
	}

	@Test
	void cardsUseTheCityTimezoneAndSkipCompletedDaysEvenWithPushOnly() {
		user.setLocationTimezone("Asia/Yekaterinburg");
		when(cards.existsById("user_2026-11-20")).thenReturn(true);

		scheduler.dispatchAt(Instant.parse("2026-11-19T02:59:59Z"));
		verify(push, never()).send(any(), any());
		scheduler.dispatchAt(Instant.parse("2026-11-19T03:00:00Z"));
		scheduler.dispatchAt(Instant.parse("2026-11-19T03:01:00Z"));
		scheduler.dispatchAt(Instant.parse("2026-11-20T03:00:00Z"));

		verifyNoInteractions(mail);
		verify(push).send(eq(device), argThat(message -> message.path().equals("/profile?reminder=cards")));
		assertThat(DiaryReminderScheduler.morningDate(Instant.parse("2026-11-19T05:10:00Z"),
				ZoneId.of("Europe/Moscow"))).isNull();
	}
}
