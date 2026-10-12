package com.calm.feature.email;

/**
 * Отправка писем пользователям. Реализация выбирается DI: SMTP или Resend.
 */
public interface EmailService {

	/**
	 * Отправить HTML-письмо.
	 *
	 * @param to       адрес получателя
	 * @param subject  тема письма
	 * @param html     тело письма в HTML
	 * @return исход отправки; исключения провайдера не пробрасываются.
	 */
	EmailSendResult send(String to, String subject, String html);
}
