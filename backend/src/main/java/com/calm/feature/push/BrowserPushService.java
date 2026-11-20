package com.calm.feature.push;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.GeneralSecurityException;
import java.security.Security;
import java.time.Duration;
import java.util.Base64;
import java.util.Locale;
import nl.martijndwars.webpush.AbstractPushService;
import nl.martijndwars.webpush.Encoding;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.Utils;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class BrowserPushService {
	private static final Logger log = LoggerFactory.getLogger(BrowserPushService.class);
	private static final ObjectMapper JSON = new ObjectMapper();
	static final Message FORECAST_MESSAGE = new Message("Calm",
			"Откройте Calm, чтобы посмотреть прогноз на сегодня.", "/profile", "calm-forecast");

	private final String publicKey;
	private final WebPushRequest sender;
	private final HttpClient http;

	public enum Delivery { SENT, EXPIRED, FAILED }
	public record Message(String title, String body, String path, String tag) {}

	public BrowserPushService(@Value("${calm.push.public-key:}") String publicKey,
			@Value("${calm.push.private-key:}") String privateKey,
			@Value("${calm.push.subject:}") String subject) {
		this.publicKey = publicKey.strip();
		this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4))
				.followRedirects(HttpClient.Redirect.NEVER).build();
		if (publicKey.isBlank() && privateKey.isBlank()) {
			sender = null;
			return;
		}
		WebPushRequest configured = null;
		try {
			if (!subject.startsWith("mailto:") && !subject.startsWith("https://")) {
				throw new IllegalArgumentException("VAPID subject required");
			}
			if (Security.getProvider("BC") == null) Security.addProvider(new BouncyCastleProvider());
			configured = new WebPushRequest(this.publicKey, privateKey.strip(), subject.strip());
		} catch (GeneralSecurityException | RuntimeException e) {
			log.warn("Web Push отключён. Проверьте пару ключей VAPID и контакт CALM_PUSH_SUBJECT.");
		}
		sender = configured;
	}

	public boolean available() { return sender != null; }
	public String publicKey() { return available() ? publicKey : null; }

	static URI pushEndpoint(String value) {
		if (value == null || value.length() > 4096) throw new IllegalArgumentException("Invalid push endpoint");
		URI uri = URI.create(value);
		String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
		String path = uri.getRawPath();
		boolean allowed = switch (host) {
			case "fcm.googleapis.com" -> path.startsWith("/fcm/send/") || path.startsWith("/wp/");
			case "updates.push.services.mozilla.com" -> path.startsWith("/wpush/");
			default -> host.equals("web.push.apple.com") || host.endsWith(".push.apple.com");
		};
		if (!"https".equals(uri.getScheme()) || !allowed || uri.getPort() != -1 || uri.getRawUserInfo() != null
				|| uri.getRawFragment() != null || path.length() <= 1 || !uri.normalize().equals(uri)) {
			throw new IllegalArgumentException("Unsupported push endpoint");
		}
		return uri;
	}

	void validateKeys(String publicValue, String auth) throws GeneralSecurityException {
		if (publicValue == null || !publicValue.matches("[A-Za-z0-9_-]{87}=?")
				|| auth == null || !auth.matches("[A-Za-z0-9_-]{22}(==)?")) {
			throw new IllegalArgumentException("Invalid browser push keys");
		}
		byte[] publicBytes = Base64.getUrlDecoder().decode(publicValue);
		if (publicBytes.length != 65 || publicBytes[0] != 4 || Base64.getUrlDecoder().decode(auth).length != 16) {
			throw new IllegalArgumentException("Invalid browser push keys");
		}
		Utils.loadPublicKey(publicValue);
	}

	public Delivery sendForecast(DevicePushSubscription subscription) {
		return send(subscription, FORECAST_MESSAGE, Duration.ofHours(4));
	}

	public Delivery send(DevicePushSubscription subscription, Message message) {
		return send(subscription, message, Duration.ofHours(2));
	}

	private Delivery send(DevicePushSubscription subscription, Message message, Duration ttl) {
		if (!available()) return Delivery.FAILED;
		try {
			int status = http.send(notificationRequest(subscription, message, ttl), HttpResponse.BodyHandlers.discarding()).statusCode();
			if (status >= 200 && status < 300) return Delivery.SENT;
			if (status == 404 || status == 410) return Delivery.EXPIRED;
			log.warn("Сервис Web Push отклонил уведомление, HTTP {}", status);
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
		} catch (Exception e) {
			log.warn("Ошибка отправки Web Push ({})", e.getClass().getSimpleName());
		}
		return Delivery.FAILED;
	}

	HttpRequest notificationRequest(DevicePushSubscription subscription, Message message, Duration ttl)
			throws GeneralSecurityException, java.io.IOException, org.jose4j.lang.JoseException {
		URI endpoint = pushEndpoint(subscription.endpoint());
		var notification = new Notification(subscription.endpoint(), subscription.p256dh(),
				subscription.auth(), JSON.writeValueAsBytes(message), Math.toIntExact(ttl.toSeconds()));
		var prepared = sender.encryptRequest(notification);
		var request = HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(8))
				.POST(HttpRequest.BodyPublishers.ofByteArray(prepared.getBody()));
		prepared.getHeaders().forEach(request::header);
		return request.build();
	}

	private static final class WebPushRequest extends AbstractPushService<WebPushRequest> {
		WebPushRequest(String publicKey, String privateKey, String subject) throws GeneralSecurityException {
			super(publicKey, privateKey, subject);
		}

		nl.martijndwars.webpush.HttpRequest encryptRequest(Notification notification)
				throws GeneralSecurityException, java.io.IOException, org.jose4j.lang.JoseException {
			return prepareRequest(notification, Encoding.AES128GCM);
		}
	}
}
