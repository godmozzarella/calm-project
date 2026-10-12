package com.calm.feature.auth;

import com.calm.feature.email.EmailService;
import com.calm.feature.email.EmailSendResult;
import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

@Service
public class EmailVerificationService {
	private static final Duration TOKEN_LIFETIME = Duration.ofHours(24);
	private static final Duration RESEND_INTERVAL = Duration.ofMinutes(1);
	private final UserRepository users;
	private final EmailService email;
	private final String publicUrl;
	private final SecureRandom random = new SecureRandom();

	public EmailVerificationService(UserRepository users, EmailService email,
			@Value("${calm.public-url:http://localhost}") String publicUrl) {
		this.users = users;
		this.email = email;
		this.publicUrl = publicUrl.replaceAll("/+$", "");
	}

	public boolean sendInitial(User user) {
		return send(user) == EmailSendResult.SENT;
	}

	public void resend(String userId) {
		User user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
		if (user.isEmailVerified()) return;
		Instant last = user.getEmailVerificationSentAt();
		if (last != null && last.plus(RESEND_INTERVAL).isAfter(Instant.now())) {
			throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Повторите отправку через минуту");
		}
		EmailSendResult result = send(user);
		if (result == EmailSendResult.RECIPIENT_RESTRICTED) {
			throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
					"Почта пока работает в тестовом режиме: письма доступны только на разрешённый адрес. Чтобы отправлять их на другие адреса, нужно подтвердить домен отправителя в Resend.");
		}
		if (result != EmailSendResult.SENT) {
			throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Письмо не отправлено. Попробуйте позже");
		}
	}

	public void verify(String token) {
		if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ссылка недействительна");
		}
		User user = users.findByEmailVerificationTokenHash(hash(token))
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ссылка недействительна"));
		if (user.getEmailVerificationExpiresAt() == null
				|| !user.getEmailVerificationExpiresAt().isAfter(Instant.now())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Срок ссылки истёк");
		}
		user.setEmailVerified(true);
		user.setEmailVerificationTokenHash(null);
		user.setEmailVerificationExpiresAt(null);
		user.setEmailVerificationSentAt(null);
		users.save(user);
	}

	private EmailSendResult send(User user) {
		byte[] bytes = new byte[32];
		random.nextBytes(bytes);
		String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		Instant now = Instant.now();
		user.setEmailVerificationTokenHash(hash(token));
		user.setEmailVerificationExpiresAt(now.plus(TOKEN_LIFETIME));
		user.setEmailVerificationSentAt(now);
		users.save(user);
		String link = publicUrl + "/verify-email#token=" + token;
		EmailSendResult result = email.send(user.getEmail(), "Подтвердите email для Calm",
				"<p>Чтобы подтвердить адрес для Calm, откройте ссылку:</p><p><a href=\"" + link
					+ "\">Подтвердить email</a></p><p>Ссылка действует 24 часа.</p>");
		if (result != EmailSendResult.SENT) {
			user.setEmailVerificationSentAt(null);
			users.save(user);
		}
		return result;
	}

	private static String hash(String value) {
		try {
			return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
					.digest(value.getBytes(StandardCharsets.US_ASCII)));
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}
}
