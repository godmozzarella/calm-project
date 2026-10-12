package com.calm.feature.email;

import com.calm.config.OutboundHttp;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Реализация {@link EmailService} через HTTP API сервиса <a href="https://resend.com">Resend</a>.
 *
 * <p>Включается при {@code calm.mail.provider=resend}. SMTP-вариант в этом случае отключается.
 * Выбран потому, что российские домашние провайдеры обычно режут исходящий SMTP-трафик
 * (порты 587/465 принимают TCP, но молчат), а HTTPS 443 ни кто не блокирует.
 *
 * <p>API: {@code POST https://api.resend.com/emails} с заголовком
 * {@code Authorization: Bearer <api-key>} и JSON-телом {from, to, subject, html}.
 *
 * <p>Если ключ не задан — сервис считается не настроенным, {@link #send} вернёт {@code false}
 * с warn-логом и не упадёт.
 */
@Service
@ConditionalOnProperty(name = "calm.mail.provider", havingValue = "resend")
public class ResendEmailService implements EmailService {

	private static final Logger log = LoggerFactory.getLogger(ResendEmailService.class);
	private static final String API_URL = "https://api.resend.com/emails";

	private final String apiKey;
	private final String fromAddress;
	private final String fromName;
	private final RestClient http;

	public ResendEmailService(
			@Value("${calm.mail.resend.api-key:}") String apiKey,
			@Value("${calm.mail.from:onboarding@resend.dev}") String fromAddress,
			@Value("${calm.mail.from-name:Calm}") String fromName
	) {
		this.apiKey = apiKey;
		this.fromAddress = fromAddress == null || fromAddress.isBlank() ? "onboarding@resend.dev" : fromAddress;
		this.fromName = fromName;
		this.http = RestClient.builder()
				.baseUrl(API_URL)
				.requestFactory(OutboundHttp.requestFactory())
				.defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
				.build();
		log.info("Email-провайдер: Resend (HTTP API), настроен={}", apiKey != null && !apiKey.isBlank());
	}

	@Override
	public EmailSendResult send(String to, String subject, String html) {
		if (apiKey == null || apiKey.isBlank()) {
			log.warn("Resend не настроен (CALM_RESEND_API_KEY пуст), письмо не отправлено");
			return EmailSendResult.FAILED;
		}
		// Resend требует From в формате "Name <email@host>" или просто "email@host".
		String from = fromName == null || fromName.isBlank()
				? fromAddress
				: fromName + " <" + fromAddress + ">";
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("from", from);
		body.put("to", to);
		body.put("subject", subject);
		body.put("html", html);
		try {
			Map<?, ?> response = http.post()
					.header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
					.body(body)
					.retrieve()
					.body(Map.class);
			String id = response == null ? null : String.valueOf(response.get("id"));
			log.info("Письмо отправлено через Resend, id={}", id);
			return EmailSendResult.SENT;
		} catch (RestClientResponseException e) {
			String responseBody = e.getResponseBodyAsString().toLowerCase(java.util.Locale.ROOT);
			if (e.getStatusCode().value() == 403
					&& responseBody.contains("only send testing emails")
					&& responseBody.contains("verify a domain")) {
				log.warn("Resend отклонил письмо: тестовый режим ограничивает адреса получателей");
				return EmailSendResult.RECIPIENT_RESTRICTED;
			}
			log.error("Resend: ошибка отправки, HTTP {}", e.getStatusCode().value());
			return EmailSendResult.FAILED;
		} catch (Exception e) {
			log.error("Resend: ошибка отправки ({})", e.getClass().getSimpleName());
			return EmailSendResult.FAILED;
		}
	}
}
