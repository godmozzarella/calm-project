package com.calm.feature.auth;

import com.calm.feature.auth.dto.AuthResponse;
import com.calm.feature.auth.dto.LoginRequest;
import com.calm.feature.auth.dto.RefreshRequest;
import com.calm.feature.auth.dto.RegisterRequest;
import com.calm.feature.user.User;
import com.calm.feature.user.UserService;
import com.calm.feature.user.dto.UserDto;
import com.calm.security.JwtService;
import com.calm.common.exception.ConflictException;
import java.util.Optional;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

	private final UserService userService;
	private final AuthSessionService sessionService;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;

	public AuthService(UserService userService, AuthSessionService sessionService,
			PasswordEncoder passwordEncoder, JwtService jwtService) {
		this.userService = userService;
		this.sessionService = sessionService;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
	}

	public User registerPending(RegisterRequest req) {
		Optional<User> existing = userService.findByEmail(req.email());
		if (existing.isPresent()) {
			User user = existing.get();
			if (user.isRegistrationPending() && !user.isEmailVerified()) {
				if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
					throw new ConflictException("Регистрация с этой почтой уже начата. Введите тот же пароль, чтобы продолжить");
				}
				return userService.updatePendingRegistration(user.getId(), req.name());
			}
			throw new ConflictException("Аккаунт с такой почтой уже зарегистрирован");
		}
		return userService.createPendingRegistration(req.email(), req.name(), req.password());
	}

	public User authenticatePendingRegistration(String email, String password) {
		User user = userService.findByEmail(email)
				.filter(User::isRegistrationPending)
				.filter(candidate -> !candidate.isEmailVerified())
				.filter(candidate -> passwordEncoder.matches(password, candidate.getPasswordHash()))
				.orElseThrow(() -> new BadCredentialsException("Проверьте email и пароль регистрации"));
		return user;
	}

	public void discardPendingRegistration(String userId) {
		userService.deletePendingRegistration(userId);
	}

	public AuthResponse login(LoginRequest req) {
		User user = userService.findByEmail(req.email())
				.orElseThrow(() -> new BadCredentialsException("invalid credentials"));
		if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
			throw new BadCredentialsException("invalid credentials");
		}
		if (user.isRegistrationPending() && !user.isEmailVerified()) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN,
					"Сначала подтвердите email: откройте регистрацию и введите тот же email и пароль, чтобы получить код");
		}
		return issueTokenPair(user);
	}

	public AuthResponse refresh(RefreshRequest req) {
		AuthSession session = sessionService.refresh(req.refreshToken());
		if (session == null) throw new BadCredentialsException("refresh token expired or session inactive");
		User user = userService.getById(session.getUserId());
		return response(user, session);
	}

	public void logout(String userId, String sessionId) {
		sessionService.revoke(sessionId, userId);
	}

	public AuthResponse issueTokenPair(User user) {
		return response(user, sessionService.create(user.getId()));
	}

	private AuthResponse response(User user, AuthSession session) {
		String accessToken = jwtService.issue(user.getId(), user.getEmail(), user.getRole().name(), session.getId());
		return new AuthResponse(accessToken, session.getRefreshToken(), UserDto.from(user));
	}
}
