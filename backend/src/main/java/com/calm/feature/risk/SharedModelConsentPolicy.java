package com.calm.feature.risk;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

/** Pilot explanation shown to participants; enrollment is gated by the operator-approved version and digest. */
public final class SharedModelConsentPolicy {
	public static final String VERSION = "shared-model-pilot-v4";
	public static final List<String> TEXT = List.of(
		"Для офлайн-проверки общей модели используются дата и балл прогноза, погодные показатели, часовой пояс и приблизительное местоположение, история приступов и препаратов, а также подтверждённый исход дня.",
		"В отдельный обучающий набор попадут подробности приступов (время начала и конца, интенсивность, тип боли, симптомы, триггеры, зоны боли) и приёмов препаратов (название, время, класс, связь с приступом и оценка действия). Имя, почта, точные координаты и свободные заметки не выгружаются.",
		"Участие добровольное. Его можно отозвать здесь; исключение уже выгруженных данных выполняется при следующей пересборке набора. Администратор также может приостановить участие, не закрывая доступ к личному дневнику. После восстановления участия понадобится новое согласие.",
		"Для прогноза после ежедневного опроса также используются ответы о сне, стрессе, новых началах, приёме препаратов и употреблении алкоголя вчера; сведения из дневника о продолжающемся приступе; указанные по желанию пол, возраст и сведения о менструальном цикле. Ответ «Не знаю» сохраняется как неизвестное значение.",
		"Признаки фиксируются в момент выдачи прогноза после опроса; цель — новое начало приступа от этого момента до местной полуночи. Исправления дневника меняют фактический исход, но не исходные признаки. Ранее собранные прогнозы до начала дня хранятся отдельно. Текущая оценка по правилам не является вероятностью приступа."
	);
	public static final String DIGEST = digest(TEXT);

	private SharedModelConsentPolicy() {}

	private static String digest(List<String> paragraphs) {
		try {
			byte[] hash = MessageDigest.getInstance("SHA-256")
				.digest(String.join("\n", paragraphs).getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(hash);
		} catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256 unavailable", exception);
		}
	}
}
