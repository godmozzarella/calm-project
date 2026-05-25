package com.calm.feature.auth;

import com.calm.feature.auth.dto.AuthResponse;
import com.calm.feature.auth.dto.LoginRequest;
import com.calm.feature.auth.dto.RefreshRequest;
import com.calm.feature.auth.dto.RegisterRequest;
import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import com.calm.feature.user.UserService;
import com.calm.feature.user.dto.UserDto;
import com.calm.security.JwtService;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class AuthService {

	private final UserService userService;
	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;

	public AuthService(UserService userService, UserRepository userRepository,
			PasswordEncoder passwordEncoder, JwtService jwtService) {
		this.userService = userService;
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
	}

	public AuthResponse register(RegisterRequest req) {
		User user = userService.create(req.email(), req.name(), req.password());
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
		User user = userRepository.findByRefreshToken(req.refreshToken())
				.orElseThrow(() -> new BadCredentialsException("invalid refresh token"));
		if (user.getRefreshTokenExpiry() == null || user.getRefreshTokenExpiry().isBefore(Instant.now())) {
			throw new BadCredentialsException("refresh token expired");
		}
		return issueTokenPair(user);
	}

	public void logout(String userId) {
		User user = userService.getById(userId);
		user.setRefreshToken(null);
		user.setRefreshTokenExpiry(null);
		userRepository.save(user);
	}

	private AuthResponse issueTokenPair(User user) {
		String accessToken = jwtService.issue(user.getId(), user.getEmail());
		String refreshToken = user.rotateRefreshToken();
		userRepository.save(user);
		return new AuthResponse(accessToken, refreshToken, UserDto.from(user));
	}
}
