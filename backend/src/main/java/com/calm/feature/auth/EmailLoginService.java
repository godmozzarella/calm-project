package com.calm.feature.auth;

import com.calm.feature.email.EmailSendResult;
import com.calm.feature.email.EmailService;
import com.calm.feature.user.User;
import com.calm.feature.user.UserService;
import jakarta.mail.internet.AddressException;
import jakarta.mail.internet.InternetAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.HtmlUtils;

@Service
public class EmailLoginService {
	private static final SecureRandom RANDOM = new SecureRandom();
	private static final int MAX_ATTEMPTS = 5;
	private static final int RESEND_SECONDS = 60;
	private static final int LIFETIME_SECONDS = 600;

	private final MongoTemplate mongo;
	private final UserService users;
	private final EmailService mail;
	private final String publicUrl;
	private final SecretKeySpec key;

	EmailLoginService(MongoTemplate mongo, UserService users, EmailService mail,
			@Value("${calm.public-url}") String publicUrl,
			@Value("${CALM_EMAIL_LOGIN_SECRET:}") String secret,
			@Value("${calm.jwt.secret}") String signingKey) {
		this.mongo = mongo;
		this.users = users;
		this.mail = mail;
		this.publicUrl = publicUrl.replaceAll("/+$", "");
		this.key = new SecretKeySpec((secret.isBlank() ? signingKey : secret).getBytes(StandardCharsets.UTF_8), "HmacSHA256");
	}

	void send(String address) {
		String email = normalizeEmail(address);
		String code = String.format(Locale.ROOT, "%04d", RANDOM.nextInt(10_000));
		String token = randomToken();
		String tokenHash = hash("link", token);
		Instant now = Instant.now();
		Query available = Query.query(Criteria.where("_id").is(email)
				.and("sentAt").lte(now.minusSeconds(RESEND_SECONDS)));
		try {
			mongo.upsert(available, new Update().set("tokenHash", tokenHash)
					.set("codeHash", hash("code", tokenHash + code))
					.set("sentAt", now).set("expiresAt", now.plusSeconds(LIFETIME_SECONDS))
					.set("attempts", 0).set("used", false), EmailLoginChallenge.class);
		} catch (DuplicateKeyException e) {
			EmailLoginChallenge current = mongo.findById(email, EmailLoginChallenge.class);
			long retry = current == null ? 1 : Math.max(1, current.sentAt().plusSeconds(61).getEpochSecond() - now.getEpochSecond());
			HttpHeaders headers = new HttpHeaders();
			headers.set(HttpHeaders.RETRY_AFTER, Long.toString(retry));
			throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
					"Письмо уже запрошено. Попробуйте через " + retry + " сек.") {
				@Override public HttpHeaders getHeaders() { return headers; }
			};
		}

		String link = publicUrl + "/email-login#" + token;
		String expiry = "Ссылка и код действуют 10 минут.";
		String ignore = "Если это были не вы, просто проигнорируйте письмо.";
		String html = "<p><a style=\"display:inline-block;padding:14px 24px;background:#23459b;color:white;"
				+ "border-radius:8px;font-size:18px\" href=\"" + HtmlUtils.htmlEscape(link)
				+ "\">Войти в Calm</a></p><p>Или введите код: <strong>" + code
				+ "</strong></p><p>" + expiry + "</p><p>" + ignore + "</p>";
		String plain = "Войти в Calm: " + link + "\n\nКод: " + code + "\n" + expiry + "\n" + ignore;
		if (mail.send(email, "Вход в Calm — ссылка и код", html, plain) != EmailSendResult.SENT) {
			mongo.updateFirst(Query.query(Criteria.where("_id").is(email).and("tokenHash").is(tokenHash)),
					new Update().set("used", true), EmailLoginChallenge.class);
			throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
					"Не удалось отправить письмо. Проверьте адрес или попробуйте снова через минуту.");
		}
	}

	User verifyCode(String address, String code) {
		String email = normalizeEmail(address);
		if (code == null || !code.matches("[0-9]{4}")) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Введите четырёхзначный код из письма");
		}
		EmailLoginChallenge challenge = mongo.findById(email, EmailLoginChallenge.class);
		if (challenge == null || challenge.used() || challenge.attempts() >= MAX_ATTEMPTS
				|| !challenge.expiresAt().isAfter(Instant.now())) throw expired();
		Query query = active(challenge.tokenHash());
		boolean matches = MessageDigest.isEqual(HexFormat.of().parseHex(challenge.codeHash()),
				HexFormat.of().parseHex(hash("code", challenge.tokenHash() + code)));
		if (matches) return consume(query);
		EmailLoginChallenge before = mongo.findAndModify(query, new Update().inc("attempts", 1), EmailLoginChallenge.class);
		if (before == null || before.attempts() + 1 >= MAX_ATTEMPTS) throw expired();
		throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Код неверный. Проверьте письмо и попробуйте снова.");
	}

	User verifyLink(String token) {
		if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) throw expired();
		return consume(active(hash("link", token)));
	}

	private User consume(Query query) {
		EmailLoginChallenge challenge = mongo.findAndModify(query, new Update().set("used", true), EmailLoginChallenge.class);
		if (challenge == null) throw expired();
		return users.confirmEmailLogin(challenge.email());
	}

	private static Query active(String tokenHash) {
		return Query.query(Criteria.where("tokenHash").is(tokenHash).and("used").is(false)
				.and("expiresAt").gt(Instant.now()).and("attempts").lt(MAX_ATTEMPTS));
	}

	private static ResponseStatusException expired() {
		return new ResponseStatusException(HttpStatus.GONE,
				"Код или ссылка больше не действуют. Получите новый код.");
	}

	public static String normalizeEmail(String address) {
		String email = address == null ? "" : address.trim().toLowerCase(Locale.ROOT);
		try {
			InternetAddress parsed = new InternetAddress(email, true);
			parsed.validate();
			if (email.length() <= 254 && email.equals(parsed.getAddress()) && parsed.getPersonal() == null
					&& email.matches("[^\\s@]+@[^\\s@.]+(?:\\.[^\\s@.]+)+")) return email;
		} catch (AddressException ignored) {
			// The same message covers all invalid addresses.
		}
		throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Введите действительный адрес электронной почты");
	}

	private String hash(String purpose, String value) {
		try {
			Mac mac = Mac.getInstance("HmacSHA256");
			mac.init(key);
			return HexFormat.of().formatHex(mac.doFinal((purpose + ":" + value).getBytes(StandardCharsets.UTF_8)));
		} catch (java.security.GeneralSecurityException e) {
			throw new IllegalStateException("HmacSHA256 unavailable", e);
		}
	}

	static String randomToken() {
		byte[] bytes = new byte[32];
		RANDOM.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}
}
