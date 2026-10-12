package com.calm.feature.risk;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

/** Pilot explanation shown to participants; enrollment is gated by the operator-approved version and digest. */
public final class SharedModelConsentPolicy {
	public static final String VERSION = "shared-model-pilot-v1";
	public static final List<String> TEXT = List.of(
		"Для офлайн-проверки общей модели используются дата и балл прогноза, погодные показатели, агрегаты приступов и препаратов, объём истории и подтверждённый исход дня. Имя, почта и заметки в обучающий набор не входят.",
		"Участие добровольное. Его можно отозвать здесь; исключение уже выгруженных данных выполняется при следующей пересборке набора. Администратор также может приостановить участие, не закрывая доступ к личному дневнику. После восстановления участия понадобится новое согласие.",
		"Текущий прогноз остаётся оценкой по правилам, а не вероятностью приступа."
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
