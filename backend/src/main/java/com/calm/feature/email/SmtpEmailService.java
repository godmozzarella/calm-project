package com.calm.feature.email;

import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

/**
 * SMTP-реализация {@link EmailService} поверх Spring {@link JavaMailSender}.
 *
 * <p>Если SMTP-параметры не заданы (username пустой) — сервис считается не настроенным,
 * {@link #send} возвращает {@code false} с warn-логом и не падает. Это нужно чтобы
 * проект мог стартовать и работать без почты пока админ не пропишет креды.
 */
@Service
@ConditionalOnProperty(name = "calm.mail.provider", havingValue = "smtp", matchIfMissing = true)
public class SmtpEmailService implements EmailService {

	private static final Logger log = LoggerFactory.getLogger(SmtpEmailService.class);

	private final JavaMailSender mailSender;
	private final String username;
	private final String fromAddress;
	private final String fromName;

	public SmtpEmailService(
			JavaMailSender mailSender,
			@Value("${spring.mail.username:}") String username,
			@Value("${calm.mail.from:}") String fromAddress,
			@Value("${calm.mail.from-name:Calm}") String fromName
	) {
		this.mailSender = mailSender;
		this.username = username;
		this.fromAddress = fromAddress == null || fromAddress.isBlank() ? username : fromAddress;
		this.fromName = fromName;
	}

	@Override
	public boolean send(String to, String subject, String html) {
		if (username == null || username.isBlank()) {
			log.warn("SMTP не настроен (CALM_SMTP_USER пуст), письмо в '{}' не отправлено", to);
			return false;
		}
		try {
			MimeMessage msg = mailSender.createMimeMessage();
			MimeMessageHelper helper = new MimeMessageHelper(msg, false, StandardCharsets.UTF_8.name());
			helper.setFrom(new InternetAddress(fromAddress, fromName, StandardCharsets.UTF_8.name()));
			helper.setTo(to);
			helper.setSubject(subject);
			helper.setText(html, true);
			mailSender.send(msg);
			log.info("Письмо отправлено: to='{}', subject='{}'", to, subject);
			return true;
		} catch (Exception e) {
			Throwable root = e;
			while (root.getCause() != null) root = root.getCause();
			log.warn("SMTP: ошибка отправки '{}': {} — {}", to, root.getClass().getSimpleName(), root.getMessage());
			return false;
		}
	}
}
