package com.calm.feature.email;

/**
 * Отправка писем пользователям. Реализация выбирается DI'ем (сейчас одна — SMTP).
 */
public interface EmailService {

	/**
	 * Отправить HTML-письмо.
	 *
	 * @param to       адрес получателя
	 * @param subject  тема письма
	 * @param html     тело письма в HTML
	 * @return true если отправка ушла в SMTP-сервер; false если сервис не сконфигурирован
	 *         или произошла ошибка (она будет залогирована, исключение не пробрасывается).
	 */
	boolean send(String to, String subject, String html);
}
