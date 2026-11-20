package com.calm.feature.user;

import com.calm.common.exception.ConflictException;
import com.calm.common.exception.ApiException;
import com.calm.feature.auth.AuthSessionRepository;
import com.calm.feature.email.EmailSendResult;
import com.calm.feature.email.EmailService;
import com.calm.feature.user.dto.EmailChangeStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

@Service
public class AccountSecurityService {
	private static final String SUPPORT_EMAIL = "calm.notifications.prj@gmail.com";
	private static final Duration EMAIL_CODE_LIFETIME = Duration.ofMinutes(10);
	private static final Duration CANCEL_LINK_LIFETIME = Duration.ofHours(48);
	private static final Duration RESEND_INTERVAL = Duration.ofSeconds(60);
	private static final int MAX_CODE_ATTEMPTS = 5;
	private static final int EMAIL_CODE_LENGTH = 6;
	private static final SecureRandom RANDOM = new SecureRandom();

	private final UserRepository users;
	private final AuthSessionRepository sessions;
	private final PasswordEncoder passwordEncoder;
	private final EmailService email;
	private final MongoTemplate mongoTemplate;
	private final String publicUrl;

	public AccountSecurityService(UserRepository users, AuthSessionRepository sessions,
			PasswordEncoder passwordEncoder, EmailService email, MongoTemplate mongoTemplate,
			@Value("${calm.public-url:http://localhost}") String publicUrl) {
		this.users = users;
		this.sessions = sessions;
		this.passwordEncoder = passwordEncoder;
		this.email = email;
		this.mongoTemplate = mongoTemplate;
		this.publicUrl = publicUrl.replaceAll("/+$", "");
	}

	public EmailChangeStatus getEmailChangeStatus(String userId) {
		User user = getUser(userId);
		if (!hasPendingChange(user)) return new EmailChangeStatus(false, null, 0, null, false);
		return status(user, Instant.now());
	}

	public EmailChangeStatus startEmailChange(String userId, String requestedEmail) {
		User user = getUser(userId);
		String newEmail = com.calm.feature.auth.EmailLoginService.normalizeEmail(requestedEmail);
		if (newEmail.equals(user.getEmail())) {
			throw new ConflictException("Это уже адрес вашей почты");
		}
		if (users.existsByEmail(newEmail)) throw new ConflictException("Аккаунт с такой почтой уже зарегистрирован");
		enforceResendCooldown(user.getPendingEmailChangeSentAt());

		Instant previousSentAt = user.getPendingEmailChangeSentAt();
		Instant now = Instant.now();
		String code = randomDigits(EMAIL_CODE_LENGTH);
		String cancelToken = randomToken();

		user.setPendingEmailChangeAddress(newEmail);
		user.setPendingEmailChangeStage("CURRENT");
		user.setPendingEmailChangeCodeHash(passwordEncoder.encode(code));
		user.setPendingEmailChangeExpiresAt(now.plus(EMAIL_CODE_LIFETIME));
		user.setPendingEmailChangeSentAt(now);
		user.setPendingEmailChangeAttempts(0);
		user.setPendingEmailChangeCancelTokenHash(hashToken(cancelToken));
		user.setPendingEmailChangeCancelExpiresAt(now.plus(CANCEL_LINK_LIFETIME));
		long changed = mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(userId)
                .and("email").is(user.getEmail())
                .and("pendingEmailChangeSentAt").is(previousSentAt)),
                new Update().set("pendingEmailChangeAddress", newEmail).set("pendingEmailChangeStage", "CURRENT")
                    .set("pendingEmailChangeCodeHash", user.getPendingEmailChangeCodeHash())
                    .set("pendingEmailChangeExpiresAt", user.getPendingEmailChangeExpiresAt())
                    .set("pendingEmailChangeSentAt", now).set("pendingEmailChangeAttempts", 0)
                    .set("pendingEmailChangeCancelTokenHash", user.getPendingEmailChangeCancelTokenHash())
                    .set("pendingEmailChangeCancelExpiresAt", user.getPendingEmailChangeCancelExpiresAt()), User.class).getMatchedCount();
        if (changed != 1) throw new ConflictException("Данные аккаунта изменились. Повторите запрос");
		sendChangeCode(user, code, cancelToken);
		return status(user, now);
	}

	public EmailChangeStatus resendEmailChangeCode(String userId) {
		User user = getUser(userId);
		if (!hasPendingChange(user)) throw new ConflictException("Нет ожидающей смены почты");
		enforceResendCooldown(user.getPendingEmailChangeSentAt());
		Instant previousSentAt = user.getPendingEmailChangeSentAt();
		Instant now = Instant.now();
		String code = randomDigits(EMAIL_CODE_LENGTH);
		String cancelToken = "CURRENT".equals(user.getPendingEmailChangeStage()) ? randomToken() : null;
		Update update = new Update();
		if (cancelToken != null) {
			update.set("pendingEmailChangeCancelTokenHash", hashToken(cancelToken))
					.set("pendingEmailChangeCancelExpiresAt", now.plus(CANCEL_LINK_LIFETIME));
		}

		user.setPendingEmailChangeCodeHash(passwordEncoder.encode(code));
		user.setPendingEmailChangeExpiresAt(now.plus(EMAIL_CODE_LIFETIME));
		user.setPendingEmailChangeSentAt(now);
		user.setPendingEmailChangeAttempts(0);
		long changed = mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(userId)
                .and("pendingEmailChangeAddress").is(user.getPendingEmailChangeAddress())
                .and("pendingEmailChangeSentAt").is(previousSentAt)
                .and("pendingEmailChangeStage").is(user.getPendingEmailChangeStage())),
                update.set("pendingEmailChangeCodeHash", user.getPendingEmailChangeCodeHash())
                    .set("pendingEmailChangeExpiresAt", user.getPendingEmailChangeExpiresAt())
                    .set("pendingEmailChangeSentAt", now).set("pendingEmailChangeAttempts", 0), User.class).getMatchedCount();
        if (changed != 1) throw new ConflictException("Запрос смены почты изменился. Обновите профиль");
		sendChangeCode(user, code, cancelToken);
		return status(user, now);
	}

	public EmailChangeStatus confirmEmailChange(String userId, String code) {
		if (code == null || !code.matches("\\d{" + EMAIL_CODE_LENGTH + "}")) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "Введите шестизначный код из письма");
		}
		User user = getUser(userId);
		if (!hasPendingChange(user)) throw new ConflictException("Нет ожидающей смены почты");
		Instant now = Instant.now();
		String storedHash = user.getPendingEmailChangeCodeHash();
		if (user.getPendingEmailChangeExpiresAt() == null || !user.getPendingEmailChangeExpiresAt().isAfter(now)) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "Код истёк. Запросите смену почты заново");
		}
		if (user.getPendingEmailChangeAttempts() >= MAX_CODE_ATTEMPTS) {
			throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
					"Слишком много попыток. Запросите новый код");
		}
		if (storedHash == null || !passwordEncoder.matches(code, storedHash)) {
			if (storedHash != null) {
				mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(userId)
						.and("pendingEmailChangeCodeHash").is(storedHash)
						.and("pendingEmailChangeAttempts").lt(MAX_CODE_ATTEMPTS)
						.and("pendingEmailChangeExpiresAt").gt(now)),
					new Update().inc("pendingEmailChangeAttempts", 1), User.class);
			}
			throw new ApiException(HttpStatus.BAD_REQUEST, user.getPendingEmailChangeAttempts() + 1 >= MAX_CODE_ATTEMPTS
					? "Попытки закончились. Запросите новый код"
					: "Код неверный. Проверьте письмо и попробуйте ещё раз");
		}
		if ("CURRENT".equals(user.getPendingEmailChangeStage())) {
			String nextCode = randomDigits(EMAIL_CODE_LENGTH);
			long moved = mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(userId)
					.and("pendingEmailChangeStage").is("CURRENT")
					.and("pendingEmailChangeCodeHash").is(storedHash)
					.and("pendingEmailChangeAttempts").lt(MAX_CODE_ATTEMPTS)
					.and("pendingEmailChangeExpiresAt").gt(now)),
					new Update().set("pendingEmailChangeStage", "NEW")
							.set("pendingEmailChangeCodeHash", passwordEncoder.encode(nextCode))
							.set("pendingEmailChangeAttempts", 0).set("pendingEmailChangeSentAt", now)
							.set("pendingEmailChangeExpiresAt", now.plus(EMAIL_CODE_LIFETIME)), User.class).getModifiedCount();
			if (moved != 1) throw new ConflictException("Код недействителен. Запросите новый код");
			user.setPendingEmailChangeStage("NEW");
			user.setPendingEmailChangeSentAt(now);
			user.setPendingEmailChangeExpiresAt(now.plus(EMAIL_CODE_LIFETIME));
			sendChangeCode(user, nextCode, null);
			return status(user, now);
		}
		String newEmail = user.getPendingEmailChangeAddress();
		if (users.existsByEmail(newEmail)) throw new ConflictException("Аккаунт с такой почтой уже зарегистрирован");
		String oldEmail = user.getEmail();
		long changed;
		try {
			changed = mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(userId)
					.and("pendingEmailChangeAddress").is(newEmail)
					.and("pendingEmailChangeStage").is("NEW")
					.and("pendingEmailChangeCodeHash").is(storedHash)
					.and("pendingEmailChangeAttempts").lt(MAX_CODE_ATTEMPTS)
					.and("pendingEmailChangeExpiresAt").gt(now)),
				clearPendingEmailUpdate().set("email", newEmail).set("emailVerified", true)
						.unset("passwordResetCodeHash").unset("passwordResetTokenHash").unset("passwordResetExpiresAt")
						.unset("passwordResetSentAt").unset("passwordResetAttempts"), User.class).getModifiedCount();
		} catch (org.springframework.dao.DuplicateKeyException e) {
			throw new ConflictException("Аккаунт с такой почтой уже зарегистрирован");
		}
		if (changed != 1) throw new ConflictException("Код недействителен. Запросите новый код");
		sessions.deleteByUserId(userId);
		email.send(oldEmail, "Почта аккаунта Calm изменена", changeCompletedHtml(newEmail));
		return new EmailChangeStatus(false, null, 0, null, false);
	}

	public void cancelEmailChange(String userId) {
		mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(userId)
				.and("pendingEmailChangeAddress").exists(true)), clearPendingEmailUpdate(), User.class);
	}

	public void cancelEmailChangeByToken(String token) {
		if (token == null || token.isBlank() || token.length() > 100) return;
		mongoTemplate.updateFirst(Query.query(Criteria.where("pendingEmailChangeCancelTokenHash").is(hashToken(token))
				.and("pendingEmailChangeCancelExpiresAt").gt(Instant.now())),
			clearPendingEmailUpdate(), User.class);
	}

	private User getUser(String userId) {
		return users.findById(userId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
	}

	private static boolean hasPendingChange(User user) {
		return user.getPendingEmailChangeAddress() != null
				&& ("CURRENT".equals(user.getPendingEmailChangeStage()) || "NEW".equals(user.getPendingEmailChangeStage()));
	}

	private static EmailChangeStatus status(User user, Instant now) {
		Instant sentAt = user.getPendingEmailChangeSentAt();
		int wait = sentAt == null ? 0 : (int) Math.max(0,
				Duration.between(now, sentAt.plus(RESEND_INTERVAL)).toSeconds() + 1);
		return new EmailChangeStatus(true, user.getPendingEmailChangeAddress(), wait,
				user.getPendingEmailChangeExpiresAt(), "CURRENT".equals(user.getPendingEmailChangeStage()));
	}

	private static void enforceResendCooldown(Instant sentAt) {
		if (sentAt == null || !sentAt.plus(RESEND_INTERVAL).isAfter(Instant.now())) return;
		long seconds = Math.max(1, Duration.between(Instant.now(), sentAt.plus(RESEND_INTERVAL)).toSeconds() + 1);
		throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
				"Повторно отправить код можно через " + seconds + " сек.");
	}

	private void ensureSent(EmailSendResult result) {
		if (result == EmailSendResult.RECIPIENT_RESTRICTED) {
			throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
					"Почтовый сервис пока не разрешает отправку на этот адрес");
		}
		if (result != EmailSendResult.SENT) {
			throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
					"Не удалось отправить письмо. Проверьте настройки почты и попробуйте снова");
		}
	}

	private void sendChangeCode(User user, String code, String cancelToken) {
		if (cancelToken != null) {
			String notice = changeRequestedHtml(user.getPendingEmailChangeAddress(), publicUrl + "/cancel-email-change#" + cancelToken);
			ensureSent(email.send(user.getEmail(), "Подтверждение смены почты Calm",
					"<p>Код для подтверждения текущего адреса: <strong>" + code
							+ "</strong>. Код действует 10 минут.</p>" + notice));
			return;
		}
		ensureSent(email.send(user.getPendingEmailChangeAddress(), "Подтверждение нового адреса Calm", verificationHtml(code)));
	}

	private String verificationHtml(String code) {
		return "<p>Подтвердите новый адрес электронной почты для Calm:</p>"
				+ "<p style=\"font-size:28px;font-weight:700;letter-spacing:8px\"><strong>" + code + "</strong></p>"
				+ "<p>Код действует 10 минут. Если вы не запрашивали смену, проигнорируйте это письмо и отмените запрос по уведомлению на прежнем адресе.</p>";
	}

	private static String changeRequestedHtml(String newEmail, String cancelUrl) {
		return "<p>Для вашего аккаунта Calm запрошена смена адреса почты на <strong>" + escapeHtml(newEmail) + "</strong>.</p>"
				+ "<p>Пока новый адрес не подтверждён, прежний остаётся адресом аккаунта.</p>"
				+ "<p><a href=\"" + cancelUrl + "\">Это были не вы? Отменить запрос</a></p>"
				+ "<p>Ссылка отмены действует 48 часов. Если запрос сделали вы, ничего делать не нужно.</p>";
	}

	private static String changeCompletedHtml(String newEmail) {
		return "<p>Адрес электронной почты вашего аккаунта Calm изменён на <strong>" + escapeHtml(newEmail) + "</strong>.</p>"
				+ "<p>Если это сделали не вы, немедленно обратитесь в поддержку: <a href=\"mailto:" + SUPPORT_EMAIL + "\">"
				+ SUPPORT_EMAIL + "</a> и смените пароль.</p>";
	}

	private static String escapeHtml(String value) {
		return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
				.replace("\"", "&quot;").replace("'", "&#39;");
	}

	private static String randomDigits(int length) {
		int value = RANDOM.nextInt((int) Math.pow(10, length));
		return String.format(Locale.ROOT, "%0" + length + "d", value);
	}

	private static String randomToken() {
		byte[] bytes = new byte[32];
		RANDOM.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	private static String hashToken(String token) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		} catch (java.security.NoSuchAlgorithmException impossible) {
			throw new IllegalStateException("SHA-256 is unavailable", impossible);
		}
	}

	private static Update clearPendingEmailUpdate() {
		return new Update().unset("pendingEmailChangeAddress").unset("pendingEmailChangeStage").unset("pendingEmailChangeCodeHash")
				.unset("pendingEmailChangeExpiresAt")
				.unset("pendingEmailChangeAttempts").unset("pendingEmailChangeCancelTokenHash")
				.unset("pendingEmailChangeCancelExpiresAt");
	}
}
