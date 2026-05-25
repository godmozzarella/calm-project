package com.calm.feature.user;

import com.calm.common.exception.ConflictException;
import com.calm.common.exception.NotFoundException;
import com.calm.feature.user.dto.UpdateUserRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class UserService {

	private final UserRepository repo;
	private final PasswordEncoder passwordEncoder;

	public UserService(UserRepository repo, PasswordEncoder passwordEncoder) {
		this.repo = repo;
		this.passwordEncoder = passwordEncoder;
	}

	public User getById(String id) {
		return repo.findById(id)
				.orElseThrow(() -> new NotFoundException("Пользователь не найден"));
	}

	public Optional<User> findByEmail(String email) {
		return repo.findByEmail(email);
	}

	public User create(String email, String name, String rawPassword) {
		if (repo.existsByEmail(email)) {
			throw new ConflictException("Пользователь с таким email уже существует");
		}
		User user = new User(email, name, passwordEncoder.encode(rawPassword));
		return repo.save(user);
	}

	public User update(String id, UpdateUserRequest req) {
		User user = getById(id);

		if (req.name() != null) user.setName(req.name());
		if (req.avatarUrl() != null) user.setAvatarUrl(req.avatarUrl());

		if (req.email() != null && !req.email().equals(user.getEmail())) {
			if (repo.existsByEmail(req.email())) {
				throw new ConflictException("Email уже занят");
			}
			user.setEmail(req.email());
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

		return repo.save(user);
	}
}
