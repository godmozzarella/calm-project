package com.calm.feature.forecast.notification;

import com.calm.feature.forecast.RiskLevel;
import com.calm.feature.forecast.dto.ForecastDayDto;
import org.springframework.stereotype.Component;

import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;

/**
 * Простой строковый рендерер HTML-письма с прогнозом риска. Без шаблонизатора
 * (Thymeleaf/FreeMarker) — для одного письма это излишне, а зависимостей меньше.
 */
@Component
public class ForecastEmailRenderer {

	private static final Locale RU = Locale.forLanguageTag("ru-RU");
	private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("d MMMM", RU);

	public String renderSubject(ForecastDayDto today) {
		String level = switch (today.risk()) {
			case HIGH -> "Высокий риск головной боли";
			case MEDIUM -> "Повышенный риск головной боли";
			case LOW -> "Прогноз на сегодня";
		};
		return "Calm · " + level;
	}

	public String renderBody(String userName, String city, ForecastDayDto today, List<ForecastDayDto> upcoming) {
		StringBuilder sb = new StringBuilder();
		sb.append("<!DOCTYPE html><html><body style=\"font-family:Arial,sans-serif;color:#1a1a1a;line-height:1.5;max-width:560px;margin:0 auto;padding:24px;\">");
		sb.append("<h2 style=\"color:#5cade4;margin:0 0 16px;\">").append(escape(greet(userName))).append("</h2>");

		sb.append("<p style=\"margin:0 0 20px;color:#555;\">Прогноз погодного риска головной боли")
				.append(city != null && !city.isBlank() ? " — <b>" + escape(city) + "</b>" : "")
				.append("</p>");

		sb.append(renderTodayCard(today));

		if (upcoming != null && !upcoming.isEmpty()) {
			sb.append("<h3 style=\"margin:24px 0 12px;font-size:15px;color:#555;\">На ближайшие дни</h3>");
			for (ForecastDayDto d : upcoming) {
				sb.append(renderDayRow(d));
			}
		}

		sb.append("<p style=\"font-size:12px;color:#888;margin-top:32px;border-top:1px solid #eee;padding-top:16px;\">")
				.append("Это не медицинское заключение. Если уведомления вам не нужны — отключите их в настройках профиля Calm.")
				.append("</p>");
		sb.append("</body></html>");
		return sb.toString();
	}

	private String renderTodayCard(ForecastDayDto today) {
		String color = colorFor(today.risk());
		String label = labelFor(today.risk());
		StringBuilder sb = new StringBuilder();
		sb.append("<div style=\"border:1px solid ").append(color).append(";border-radius:12px;padding:16px 20px;background:").append(color).append("10;\">");
		sb.append("<div style=\"font-size:13px;color:#888;\">Сегодня · ").append(today.date().format(DAY_FMT)).append("</div>");
		sb.append("<div style=\"font-size:22px;font-weight:600;color:").append(color).append(";margin:4px 0 12px;\">").append(escape(label)).append("</div>");

		if (today.reasons() != null && !today.reasons().isEmpty()) {
			sb.append("<ul style=\"margin:0;padding-left:18px;color:#333;\">");
			for (String r : today.reasons()) sb.append("<li>").append(escape(r)).append("</li>");
			sb.append("</ul>");
		} else {
			sb.append("<p style=\"margin:0;color:#555;\">Спокойная погода. Резких перепадов не ожидается.</p>");
		}
		sb.append("</div>");
		return sb.toString();
	}

	private String renderDayRow(ForecastDayDto d) {
		String color = colorFor(d.risk());
		return "<div style=\"display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #eee;\">"
				+ "<span style=\"color:#444;\">" + d.date().format(DAY_FMT) + " · "
				+ d.date().getDayOfWeek().getDisplayName(TextStyle.SHORT, RU) + "</span>"
				+ "<span style=\"color:" + color + ";font-weight:600;\">" + labelFor(d.risk()) + "</span>"
				+ "</div>";
	}

	private static String greet(String name) {
		if (name == null || name.isBlank()) return "Привет!";
		return "Привет, " + name + "!";
	}

	private static String labelFor(RiskLevel r) {
		return switch (r) {
			case HIGH -> "Высокий риск";
			case MEDIUM -> "Повышенный риск";
			case LOW -> "Низкий риск";
		};
	}

	private static String colorFor(RiskLevel r) {
		return switch (r) {
			case HIGH -> "#e25c5c";
			case MEDIUM -> "#e2a85c";
			case LOW -> "#63ca8a";
		};
	}

	private static String escape(String s) {
		if (s == null) return "";
		return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
	}
}
