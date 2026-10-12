package com.calm.feature.auth;

import com.calm.feature.auth.dto.AuthResponse;
import com.calm.feature.auth.dto.LoginRequest;
import com.calm.feature.auth.dto.RefreshRequest;
import com.calm.feature.auth.dto.RegisterRequest;
import com.calm.feature.user.User;
import com.calm.feature.user.UserService;
import com.calm.feature.user.dto.UserDto;
import com.calm.security.JwtService;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

	private final UserService userService;
	private final AuthSessionService sessionService;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;
	private final EmailVerificationService emailVerification;

	public AuthService(UserService userService, AuthSessionService sessionService,
			PasswordEncoder passwordEncoder, JwtService jwtService, EmailVerificationService emailVerification) {
		this.userService = userService;
		this.sessionService = sessionService;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
		this.emailVerification = emailVerification;
	}

	public AuthResponse register(RegisterRequest req) {
		User user = userService.create(req.email(), req.name(), req.password());
		emailVerification.sendInitial(user);
		return issueTokenPair(user);
	}

	public AuthResponse login(LoginRequest req) {
		User user = userService.findByEmail(req.email())
				.orElseThrow(() -> new BadCredentialsException("invalid credentials"));
		if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
			throw new BadCredentialsException("invalid credentials");
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

	private AuthResponse issueTokenPair(User user) {
		return response(user, sessionService.create(user.getId()));
	}

	private AuthResponse response(User user, AuthSession session) {
		String accessToken = jwtService.issue(user.getId(), user.getEmail(), user.getRole().name(), session.getId());
		return new AuthResponse(accessToken, session.getRefreshToken(), UserDto.from(user));
	}
}
