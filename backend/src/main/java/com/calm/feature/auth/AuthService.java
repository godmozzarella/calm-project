package com.calm.feature.auth;

import com.calm.feature.auth.dto.AuthResponse;
import com.calm.feature.auth.dto.LoginRequest;
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
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;

	public AuthService(UserService userService, PasswordEncoder passwordEncoder, JwtService jwtService) {
		this.userService = userService;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
	}

	public AuthResponse register(RegisterRequest req) {
		User user = userService.create(req.email(), req.name(), req.password());
		String token = jwtService.issue(user.getId(), user.getEmail());
		return new AuthResponse(token, UserDto.from(user));
	}

	public AuthResponse login(LoginRequest req) {
		User user = userService.findByEmail(req.email())
				.orElseThrow(() -> new BadCredentialsException("invalid credentials"));
		if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
			throw new BadCredentialsException("invalid credentials");
		}
		String token = jwtService.issue(user.getId(), user.getEmail());
		return new AuthResponse(token, UserDto.from(user));
	}
}
