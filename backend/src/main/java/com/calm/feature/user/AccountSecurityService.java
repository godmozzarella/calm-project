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
	private static final Duration RESEND_INTERVAL = Duration.ofSeconds(30);
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

	public void changePassword(String userId, String currentPassword, String newPassword) {
		User user = getUser(userId);
		verifyCurrentPassword(user, currentPassword, "Введите текущий пароль");
        com.calm.security.PasswordPolicy.validate(newPassword);
		if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "Новый пароль должен отличаться от текущего");
		}
		long changed = mongoTemplate.updateFirst(
				Query.query(Criteria.where("_id").is(userId).and("passwordHash").is(user.getPasswordHash())),
				new Update().set("passwordHash", passwordEncoder.encode(newPassword))
						.unset("passwordResetCodeHash").unset("passwordResetTokenHash").unset("passwordResetExpiresAt")
						.unset("passwordResetSentAt").unset("passwordResetAttempts")
						.unset("pendingEmailChangeAddress").unset("pendingEmailChangeCodeHash")
						.unset("pendingEmailChangeExpiresAt").unset("pendingEmailChangeSentAt")
						.unset("pendingEmailChangeAttempts").unset("pendingEmailChangeCancelTokenHash")
						.unset("pendingEmailChangeCancelExpiresAt"),
					User.class).getModifiedCount();
		if (changed != 1) throw new ConflictException("Данные аккаунта изменились. Войдите снова и повторите попытку");
		sessions.deleteByUserId(userId);
		sendPasswordChangedNotice(user.getEmail());
	}

	/** Always returns normally for unknown, unverified, or throttled addresses. */
	public void requestPasswordReset(String requestedEmail) {
		String address = normalize(requestedEmail);
		if (address == null) return;
		User user = users.findByEmail(address).filter(User::isEmailVerified).orElse(null);
		if (user == null) return;
		Instant now = Instant.now();
		Instant lastSent = user.getPasswordResetSentAt();
		if (lastSent != null && lastSent.plus(RESEND_INTERVAL).isAfter(now)) return;
		String code = randomDigits(EMAIL_CODE_LENGTH);

		user.setPasswordResetCodeHash(passwordEncoder.encode(code));
		user.setPasswordResetExpiresAt(now.plus(EMAIL_CODE_LIFETIME));
		user.setPasswordResetSentAt(now);
		user.setPasswordResetAttempts(0);
		long changed = mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(user.getId())
                .and("passwordHash").is(user.getPasswordHash()).and("email").is(user.getEmail())
                .and("passwordResetSentAt").is(lastSent)),
                new Update().unset("passwordResetTokenHash").set("passwordResetCodeHash", user.getPasswordResetCodeHash())
                    .set("passwordResetExpiresAt", user.getPasswordResetExpiresAt())
                    .set("passwordResetSentAt", now).set("passwordResetAttempts", 0), User.class).getMatchedCount();
        if (changed != 1) return;
		EmailSendResult result = email.send(user.getEmail(), "Восстановление пароля Calm", passwordResetHtml(code));
		if (result != EmailSendResult.SENT) {
			System.getLogger(AccountSecurityService.class.getName()).log(System.Logger.Level.WARNING,
					"Не удалось отправить письмо для восстановления пароля");
			return;
		}
	}

	public String verifyPasswordReset(String requestedEmail, String code) {
		String address = normalize(requestedEmail);
		User user = address == null ? null : users.findByEmail(address).filter(User::isEmailVerified).orElse(null);
		if (user == null || code == null || !code.matches("\\d{" + EMAIL_CODE_LENGTH + "}")) {
			throw invalidResetCode();
		}
		String storedHash = user.getPasswordResetCodeHash();
		if (user.getPasswordResetAttempts() >= MAX_CODE_ATTEMPTS
				|| storedHash == null
				|| user.getPasswordResetExpiresAt() == null
				|| !user.getPasswordResetExpiresAt().isAfter(Instant.now())
				|| !passwordEncoder.matches(code, storedHash)) {
			if (storedHash != null) {
				mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(user.getId())
						.and("passwordResetCodeHash").is(storedHash)
						.and("passwordResetAttempts").lt(MAX_CODE_ATTEMPTS)
						.and("passwordResetExpiresAt").gt(Instant.now())),
					new Update().inc("passwordResetAttempts", 1), User.class);
			}
			throw invalidResetCode();
		}
        String token = randomToken();
        long verified = mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(user.getId())
                .and("email").is(address).and("passwordHash").is(user.getPasswordHash())
                .and("passwordResetCodeHash").is(storedHash)
                .and("passwordResetAttempts").lt(MAX_CODE_ATTEMPTS)
                .and("passwordResetExpiresAt").gt(Instant.now())),
            new Update().unset("passwordResetCodeHash").set("passwordResetTokenHash", hashToken(token)), User.class).getModifiedCount();
        if (verified != 1) throw invalidResetCode();
        return token;
    }

    public void resetPassword(String requestedEmail, String verificationToken, String newPassword) {
        String address = normalize(requestedEmail);
        User user = address == null ? null : users.findByEmail(address).filter(User::isEmailVerified).orElse(null);
        if (user == null || verificationToken == null || !verificationToken.matches("[A-Za-z0-9_-]{43}")
                || user.getPasswordResetTokenHash() == null
                || !user.getPasswordResetTokenHash().equals(hashToken(verificationToken))
                || user.getPasswordResetExpiresAt() == null || !user.getPasswordResetExpiresAt().isAfter(Instant.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Подтверждение недействительно или срок его действия истёк. Начните восстановление заново.");
        }
        com.calm.security.PasswordPolicy.validate(newPassword);
        long changed = mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(user.getId())
                .and("email").is(address).and("passwordHash").is(user.getPasswordHash())
                .and("passwordResetTokenHash").is(user.getPasswordResetTokenHash())
                .and("passwordResetExpiresAt").gt(Instant.now())),
            new Update().set("passwordHash", passwordEncoder.encode(newPassword))
                .unset("passwordResetCodeHash").unset("passwordResetTokenHash").unset("passwordResetExpiresAt")
                .unset("passwordResetSentAt").unset("passwordResetAttempts")
                .unset("pendingEmailChangeAddress").unset("pendingEmailChangeCodeHash")
                .unset("pendingEmailChangeExpiresAt").unset("pendingEmailChangeSentAt")
                .unset("pendingEmailChangeAttempts").unset("pendingEmailChangeCancelTokenHash")
                .unset("pendingEmailChangeCancelExpiresAt"), User.class).getModifiedCount();
        if (changed != 1) throw new ApiException(HttpStatus.BAD_REQUEST, "Подтверждение недействительно или срок его действия истёк. Начните восстановление заново.");
		sessions.deleteByUserId(user.getId());
		sendPasswordChangedNotice(user.getEmail());
	}

	public EmailChangeStatus getEmailChangeStatus(String userId) {
		User user = getUser(userId);
		if (!hasPendingChange(user)) return new EmailChangeStatus(false, null, 0, null);
		return status(user, Instant.now());
	}

	public EmailChangeStatus startEmailChange(String userId, String currentPassword, String requestedEmail) {
		User user = getUser(userId);
		verifyCurrentPassword(user, currentPassword, "Введите текущий пароль для смены почты");
		String newEmail = normalize(requestedEmail);
		if (newEmail == null || newEmail.isBlank()) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "Укажите новый адрес электронной почты");
		}
		if (newEmail.equals(user.getEmail())) {
			throw new ConflictException("Это уже адрес вашей почты");
		}
		if (users.existsByEmail(newEmail)) throw new ConflictException("Аккаунт с такой почтой уже зарегистрирован");
		if (hasPendingChange(user)) enforceResendCooldown(user.getPendingEmailChangeSentAt());

		Instant previousSentAt = user.getPendingEmailChangeSentAt();
		Instant now = Instant.now();
		String code = randomDigits(EMAIL_CODE_LENGTH);
		String cancelToken = randomToken();

		user.setPendingEmailChangeAddress(newEmail);
		user.setPendingEmailChangeCodeHash(passwordEncoder.encode(code));
		user.setPendingEmailChangeExpiresAt(now.plus(EMAIL_CODE_LIFETIME));
		user.setPendingEmailChangeSentAt(now);
		user.setPendingEmailChangeAttempts(0);
		user.setPendingEmailChangeCancelTokenHash(hashToken(cancelToken));
		user.setPendingEmailChangeCancelExpiresAt(now.plus(CANCEL_LINK_LIFETIME));
		long changed = mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(userId)
                .and("passwordHash").is(user.getPasswordHash()).and("email").is(user.getEmail())
                .and("pendingEmailChangeSentAt").is(previousSentAt)),
                new Update().set("pendingEmailChangeAddress", newEmail)
                    .set("pendingEmailChangeCodeHash", user.getPendingEmailChangeCodeHash())
                    .set("pendingEmailChangeExpiresAt", user.getPendingEmailChangeExpiresAt())
                    .set("pendingEmailChangeSentAt", now).set("pendingEmailChangeAttempts", 0)
                    .set("pendingEmailChangeCancelTokenHash", user.getPendingEmailChangeCancelTokenHash())
                    .set("pendingEmailChangeCancelExpiresAt", user.getPendingEmailChangeCancelExpiresAt()), User.class).getMatchedCount();
        if (changed != 1) throw new ConflictException("Данные аккаунта изменились. Повторите запрос");
		EmailSendResult result = email.send(newEmail, "Подтверждение нового адреса Calm", verificationHtml(code));
		ensureSent(result);


		EmailSendResult notice = email.send(user.getEmail(), "Запрошена смена почты в Calm",
				changeRequestedHtml(newEmail, publicUrl + "/cancel-email-change#" + cancelToken));
		if (notice != EmailSendResult.SENT) {
			// The change remains pending; the new address still must be verified.
			System.getLogger(AccountSecurityService.class.getName()).log(System.Logger.Level.WARNING,
					"Не удалось доставить уведомление о смене почты на прежний адрес");
		}
		return status(user, now);
	}

	public EmailChangeStatus resendEmailChangeCode(String userId) {
		User user = getUser(userId);
		if (!hasPendingChange(user)) throw new ConflictException("Нет ожидающей смены почты");
		enforceResendCooldown(user.getPendingEmailChangeSentAt());
		Instant previousSentAt = user.getPendingEmailChangeSentAt();
		Instant now = Instant.now();
		String code = randomDigits(EMAIL_CODE_LENGTH);

		user.setPendingEmailChangeCodeHash(passwordEncoder.encode(code));
		user.setPendingEmailChangeExpiresAt(now.plus(EMAIL_CODE_LIFETIME));
		user.setPendingEmailChangeSentAt(now);
		user.setPendingEmailChangeAttempts(0);
		long changed = mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(userId)
                .and("pendingEmailChangeAddress").is(user.getPendingEmailChangeAddress())
                .and("pendingEmailChangeSentAt").is(previousSentAt)
                .and("passwordHash").is(user.getPasswordHash())),
                new Update().set("pendingEmailChangeCodeHash", user.getPendingEmailChangeCodeHash())
                    .set("pendingEmailChangeExpiresAt", user.getPendingEmailChangeExpiresAt())
                    .set("pendingEmailChangeSentAt", now).set("pendingEmailChangeAttempts", 0), User.class).getMatchedCount();
        if (changed != 1) throw new ConflictException("Запрос смены почты изменился. Обновите профиль");
		EmailSendResult result = email.send(user.getPendingEmailChangeAddress(),
				"Подтверждение нового адреса Calm", verificationHtml(code));
		ensureSent(result);
		return status(user, now);
	}

	public void confirmEmailChange(String userId, String code) {
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
		String newEmail = user.getPendingEmailChangeAddress();
		if (users.existsByEmail(newEmail)) throw new ConflictException("Аккаунт с такой почтой уже зарегистрирован");
		String oldEmail = user.getEmail();
		long changed;
		try {
			changed = mongoTemplate.updateFirst(Query.query(Criteria.where("_id").is(userId)
					.and("pendingEmailChangeAddress").is(newEmail)
					.and("pendingEmailChangeCodeHash").is(storedHash)
					.and("pendingEmailChangeAttempts").lt(MAX_CODE_ATTEMPTS)
					.and("pendingEmailChangeExpiresAt").gt(now)),
				new Update().set("email", newEmail).set("emailVerified", true)
						.unset("passwordResetCodeHash").unset("passwordResetTokenHash").unset("passwordResetExpiresAt")
						.unset("passwordResetSentAt").unset("passwordResetAttempts")
						.unset("pendingEmailChangeAddress").unset("pendingEmailChangeCodeHash")
						.unset("pendingEmailChangeExpiresAt").unset("pendingEmailChangeSentAt")
						.unset("pendingEmailChangeAttempts").unset("pendingEmailChangeCancelTokenHash")
						.unset("pendingEmailChangeCancelExpiresAt"), User.class).getModifiedCount();
		} catch (org.springframework.dao.DuplicateKeyException e) {
			throw new ConflictException("Аккаунт с такой почтой уже зарегистрирован");
		}
		if (changed != 1) throw new ConflictException("Код недействителен. Запросите новый код");
		sessions.deleteByUserId(userId);
		email.send(oldEmail, "Почта аккаунта Calm изменена", changeCompletedHtml(newEmail));
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

	private void verifyCurrentPassword(User user, String currentPassword, String missingMessage) {
		if (currentPassword == null || currentPassword.isBlank()) {
			throw new ApiException(HttpStatus.BAD_REQUEST, missingMessage);
		}
		if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
			throw new ConflictException("Неверный пароль");
		}
	}

	private static boolean hasPendingChange(User user) {
		return user.getPendingEmailChangeAddress() != null;
	}

	private static EmailChangeStatus status(User user, Instant now) {
		Instant sentAt = user.getPendingEmailChangeSentAt();
		int wait = sentAt == null ? 0 : (int) Math.max(0,
				Duration.between(now, sentAt.plus(RESEND_INTERVAL)).toSeconds() + 1);
		return new EmailChangeStatus(true, user.getPendingEmailChangeAddress(), wait,
				user.getPendingEmailChangeExpiresAt());
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

	private void sendPasswordChangedNotice(String address) {
		EmailSendResult result = email.send(address, "Пароль аккаунта Calm изменён",
				"<p>Пароль вашего аккаунта Calm был изменён.</p>"
				+ "<p>Если это сделали не вы, восстановите доступ к аккаунту и обратитесь в поддержку: <a href=\"mailto:"
				+ SUPPORT_EMAIL + "\">" + SUPPORT_EMAIL + "</a>.</p>");
		if (result != EmailSendResult.SENT) {
			System.getLogger(AccountSecurityService.class.getName()).log(System.Logger.Level.WARNING,
					"Не удалось отправить уведомление об изменении пароля");
		}
	}

	private static String passwordResetHtml(String code) {
		return "<p>Код для восстановления пароля Calm:</p>"
				+ "<p style=\"font-size:28px;font-weight:700;letter-spacing:8px\"><strong>" + code + "</strong></p>"
				+ "<p>Код действует 10 минут. Если вы не запрашивали восстановление, проигнорируйте это письмо.</p>";
	}

	private static ResponseStatusException invalidResetCode() {
		return new ResponseStatusException(HttpStatus.BAD_REQUEST,
				"Код неверный или истёк. Запросите новый код и попробуйте снова");
	}

	private static String escapeHtml(String value) {
		return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
				.replace("\"", "&quot;").replace("'", "&#39;");
	}

	private static String normalize(String value) {
		return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
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
		return new Update().unset("pendingEmailChangeAddress").unset("pendingEmailChangeCodeHash")
				.unset("pendingEmailChangeExpiresAt").unset("pendingEmailChangeSentAt")
				.unset("pendingEmailChangeAttempts").unset("pendingEmailChangeCancelTokenHash")
				.unset("pendingEmailChangeCancelExpiresAt");
	}
}
