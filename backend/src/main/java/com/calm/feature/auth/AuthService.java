package com.calm.feature.auth;

import com.calm.feature.auth.dto.AuthResponse;
import com.calm.feature.user.User;
import com.calm.feature.user.UserService;
import com.calm.feature.user.dto.UserDto;
import com.calm.security.JwtService;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
	private final UserService users;
	private final AuthSessionService sessions;
	private final JwtService jwt;

	public AuthService(UserService users, AuthSessionService sessions, JwtService jwt) {
		this.users = users;
		this.sessions = sessions;
		this.jwt = jwt;
	}

	AuthResponse login(User user, String cookie) {
		AuthSession session = sessions.createCookieSession(user.getId(), user.getEmail(), cookie);
		return response(user, session);
	}

	record Refreshed(AuthResponse response, boolean migrated) {}

	Refreshed refresh(String cookie, String legacy, String replacement) {
		AuthSession session = AuthSessionService.validCookie(cookie) ? sessions.findCookieSession(cookie) : null;
		boolean migrating = session == null;
		if (migrating && legacy != null && legacy.matches("[0-9a-f-]{36}")) {
			session = sessions.migrate(legacy, replacement);
		}
		if (session == null) throw new BadCredentialsException("session inactive");
		User user = users.getById(session.getUserId());
		if (session.getLoginEmail() != null && !session.getLoginEmail().equals(user.getEmail())) {
			throw new BadCredentialsException("email changed");
		}
		return new Refreshed(response(user, session), migrating);
	}

	private AuthResponse response(User user, AuthSession session) {
		String token = jwt.issue(user.getId(), user.getEmail(), user.getRole().name(), session.getId());
		return new AuthResponse(token, UserDto.from(user));
	}
}
