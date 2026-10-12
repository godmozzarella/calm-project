package com.calm.feature.user;

import com.calm.common.exception.ConflictException;
import com.calm.common.exception.NotFoundException;
import com.calm.feature.user.dto.UpdateUserRequest;
import com.calm.feature.auth.AuthSessionRepository;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.Locale;

@Service
public class UserService {

	private final UserRepository repo;
	private final PasswordEncoder passwordEncoder;
	private final AuthSessionRepository sessions;
	public UserService(UserRepository repo, PasswordEncoder passwordEncoder, AuthSessionRepository sessions) {
		this.repo = repo;
		this.passwordEncoder = passwordEncoder;
		this.sessions = sessions;
	}

	public User getById(String id) {
		return repo.findById(id)
				.orElseThrow(() -> new NotFoundException("Пользователь не найден"));
	}

	public Optional<User> findByEmail(String email) {
		return repo.findByEmail(normalizeEmail(email));
	}

	public User create(String email, String name, String rawPassword) {
		email = normalizeEmail(email);
		if (repo.existsByEmail(email)) {
			throw new ConflictException("Пользователь с таким email уже существует");
		}
		User user = new User(email, name, passwordEncoder.encode(rawPassword));
		try {
			return repo.save(user);
		} catch (DuplicateKeyException e) {
			throw new ConflictException("Пользователь с таким email уже существует");
		}
	}

	public User update(String id, UpdateUserRequest req) {
		User user = getById(id);

		if (req.name() != null) user.setName(req.name());
		if (req.avatarUrl() != null) user.setAvatarUrl(req.avatarUrl());

		String newEmail = req.email() == null ? null : normalizeEmail(req.email());
		if (newEmail != null && !newEmail.equals(user.getEmail())) {
			if (req.currentPassword() == null || !passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
				throw new ConflictException("Для смены email введите текущий пароль");
			}
			if (repo.existsByEmail(newEmail)) {
				throw new ConflictException("Email уже занят");
			}
			user.setEmail(newEmail);
			user.setEmailVerified(false);
			user.setEmailVerificationTokenHash(null);
			user.setEmailVerificationExpiresAt(null);
			user.setEmailVerificationSentAt(null);
		}

		if (req.newPassword() != null) {
			if (req.currentPassword() == null
					|| !passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
				throw new ConflictException("Текущий пароль введён неверно");
			}
			user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
		}

		// Локация. Если переданы все три поля — обновляем; если переданы null'ы при наличии
		// флага сброса, пользователь снимает геолокацию (city == "" будем трактовать как очистку).
		if (req.latitude() != null && req.longitude() != null) {
			user.setLatitude(req.latitude());
			user.setLongitude(req.longitude());
			if (req.city() != null) user.setCity(req.city());
		}
		if (req.notificationsEnabled() != null) {
			user.setNotificationsEnabled(req.notificationsEnabled());
		}

		try {
			User saved = repo.save(user);
			if (req.newPassword() != null) sessions.deleteByUserId(id);
			return saved;
		} catch (DuplicateKeyException e) {
			throw new ConflictException("Email уже занят");
		}
	}

	private static String normalizeEmail(String email) {
		return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
	}
}
