package com.calm.feature.user;

import com.calm.common.exception.NotFoundException;
import com.calm.feature.attack.AttackRepository;
import com.calm.feature.medication.MedicationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Каскадное удаление аккаунта: приступы, препараты, файл аватара и сам пользователь.
 * Выделен в отдельный сервис, чтобы не плодить циклические зависимости между
 * UserService ↔ AttackRepository ↔ MedicationRepository.
 */
@Service
public class AccountDeletionService {

	private static final Logger log = LoggerFactory.getLogger(AccountDeletionService.class);

	private final UserRepository userRepository;
	private final AttackRepository attackRepository;
	private final MedicationRepository medicationRepository;
	private final Path uploadDir;

	public AccountDeletionService(
			UserRepository userRepository,
			AttackRepository attackRepository,
			MedicationRepository medicationRepository,
			@Value("${calm.upload-dir:./uploads/avatars}") String uploadDir
	) {
		this.userRepository = userRepository;
		this.attackRepository = attackRepository;
		this.medicationRepository = medicationRepository;
		this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
	}

	public void deleteAccount(String userId) {
		User user = userRepository.findById(userId)
				.orElseThrow(() -> new NotFoundException("Пользователь не найден"));

		long attacks = attackRepository.deleteByUserId(userId);
		long meds = medicationRepository.deleteByUserId(userId);

		// Аватар-файл удаляем best-effort: даже если не получилось — пользователя всё равно сносим.
		tryDeleteAvatar(user.getAvatarUrl());

		userRepository.delete(user);
		log.info("Аккаунт {} удалён: приступов={}, препаратов={}", user.getEmail(), attacks, meds);
	}

	private void tryDeleteAvatar(String avatarUrl) {
		if (avatarUrl == null || avatarUrl.isBlank()) return;
		try {
			// avatarUrl выглядит как "http://host/api/public/avatars/{filename}".
			String filename = avatarUrl.substring(avatarUrl.lastIndexOf('/') + 1);
			if (filename.isBlank() || filename.contains("..")) return;
			Files.deleteIfExists(uploadDir.resolve(filename));
		} catch (IOException e) {
			log.warn("Не удалось удалить файл аватара '{}': {}", avatarUrl, e.getMessage());
		}
	}
}
