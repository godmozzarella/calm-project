package com.calm.feature.auth;

import com.calm.feature.email.EmailService;
import com.calm.feature.email.EmailSendResult;
import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

@Service
public class EmailVerificationService {
	private static final Duration CODE_LIFETIME = Duration.ofMinutes(5);
	private static final Duration RESEND_INTERVAL = Duration.ofSeconds(30);
	private static final int MAX_CODE_ATTEMPTS = 5;
	private final UserRepository users;
	private final EmailService email;
	private final PasswordEncoder passwordEncoder;
	private final MongoTemplate mongo;
	private final SecureRandom random = new SecureRandom();

	public EmailVerificationService(UserRepository users, EmailService email, PasswordEncoder passwordEncoder, MongoTemplate mongo) {
		this.users = users;
		this.mongo = mongo;
		this.email = email;
		this.passwordEncoder = passwordEncoder;
	}

	/** Sends a fresh code to this user's saved email. A successful resend replaces the previous code. */
	public void sendCode(String userId) {
		User user = users.findById(userId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
		if (user.isEmailVerified()) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Email уже подтверждён");
		}

		Instant now = Instant.now();
		Instant lastSent = user.getEmailVerificationSentAt();
		if (lastSent != null && lastSent.plus(RESEND_INTERVAL).isAfter(now)) {
			long seconds = Math.max(1, Duration.between(now, lastSent.plus(RESEND_INTERVAL)).toSeconds() + 1);
			throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
					"Повторно отправить код можно через " + seconds + " сек.");
		}

		String code = String.format(Locale.ROOT, "%04d", random.nextInt(10_000));

		user.setEmailVerificationCodeHash(passwordEncoder.encode(code));
		user.setEmailVerificationExpiresAt(now.plus(CODE_LIFETIME));
		user.setEmailVerificationSentAt(now);
		user.setEmailVerificationAttempts(0);
		long changed = mongo.updateFirst(Query.query(Criteria.where("_id").is(userId)
                .and("emailVerified").ne(true).and("email").is(user.getEmail())
                .and("emailVerificationSentAt").is(lastSent)),
                new Update().set("emailVerificationCodeHash", user.getEmailVerificationCodeHash())
                    .set("emailVerificationExpiresAt", user.getEmailVerificationExpiresAt())
                    .set("emailVerificationSentAt", now).set("emailVerificationAttempts", 0), User.class).getMatchedCount();
        if (changed != 1) throw new ResponseStatusException(HttpStatus.CONFLICT, "Запрос изменился. Повторите регистрацию");
		EmailSendResult result = email.send(user.getEmail(), "Код подтверждения email для Calm",
				"<p>Код подтверждения для Calm:</p><p style=\"font-size:28px;font-weight:700;letter-spacing:8px\"><strong>"
						+ code + "</strong></p><p>Код действует 5 минут. Если вы не запрашивали его, просто проигнорируйте это письмо.</p>");
		if (result == EmailSendResult.RECIPIENT_RESTRICTED) {
			throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
					"Почтовый сервис пока разрешает отправку только на подтверждённый адрес владельца");
		}
		if (result != EmailSendResult.SENT) {
			throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
					"Не удалось отправить код. Проверьте настройки почты и попробуйте снова");
		}

	}

	/** Starts or resumes the registration flow and returns seconds until resend is available. */
	public int startRegistration(String userId) {
		User user = users.findById(userId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
		if (user.isEmailVerified()) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Email уже подтверждён");
		}
		Instant now = Instant.now();
		Instant lastSent = user.getEmailVerificationSentAt();
		if (lastSent != null && lastSent.plus(RESEND_INTERVAL).isAfter(now)) {
			return (int) Math.max(1, Duration.between(now, lastSent.plus(RESEND_INTERVAL)).toSeconds() + 1);
		}
		sendCode(userId);
		return (int) RESEND_INTERVAL.toSeconds();
	}

	public User verify(String userId, String code) {
		if (code == null || !code.matches("\\d{4}")) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Введите четырёхзначный код");
		}
		User user = users.findById(userId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
		if (user.isEmailVerified()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Email уже подтверждён. Выполните вход");

        Instant now = Instant.now();
        String codeHash = user.getEmailVerificationCodeHash();
        if (codeHash == null || user.getEmailVerificationExpiresAt() == null
                || !user.getEmailVerificationExpiresAt().isAfter(now)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Код истёк или не отправлялся. Запросите новый код");
        }
        if (user.getEmailVerificationAttempts() >= MAX_CODE_ATTEMPTS) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Слишком много попыток. Запросите новый код");
        }
        Query valid = Query.query(Criteria.where("_id").is(userId).and("emailVerified").ne(true)
                .and("emailVerificationCodeHash").is(codeHash)
                .and("emailVerificationExpiresAt").gt(now)
                .and("emailVerificationAttempts").lt(MAX_CODE_ATTEMPTS));
        if (!passwordEncoder.matches(code, codeHash)) {
            mongo.updateFirst(valid, new Update().inc("emailVerificationAttempts", 1), User.class);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Код неверный. Проверьте письмо и попробуйте ещё раз");
        }
        User verified = mongo.findAndModify(valid, new Update().set("emailVerified", true)
                .set("registrationPending", false).unset("emailVerificationCodeHash")
                .unset("emailVerificationExpiresAt").unset("emailVerificationSentAt")
                .set("emailVerificationAttempts", 0), FindAndModifyOptions.options().returnNew(true), User.class);
        if (verified == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Код уже использован или заменён. Повторите вход");
        return verified;
    }
}
