package com.calm.feature.auth;

import com.calm.feature.auth.dto.AuthResponse;
import com.calm.feature.auth.dto.LoginRequest;
import com.calm.feature.auth.dto.RefreshRequest;
import com.calm.feature.auth.dto.RegisterRequest;
import com.calm.feature.auth.dto.VerifyEmailRequest;
import com.calm.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {

	private final AuthService authService;
	private final AuthSessionService sessionService;
	private final EmailVerificationService emailVerification;

	public AuthController(AuthService authService, AuthSessionService sessionService,
			EmailVerificationService emailVerification) {
		this.authService = authService;
		this.sessionService = sessionService;
		this.emailVerification = emailVerification;
	}

	@PostMapping("/register")
	public AuthResponse register(@Valid @RequestBody RegisterRequest req) {
		return authService.register(req);
	}

	@PostMapping("/login")
	public AuthResponse login(@Valid @RequestBody LoginRequest req) {
		return authService.login(req);
	}

	@PostMapping("/verify-email")
	public ResponseEntity<Void> verifyEmail(
			@Valid @RequestBody VerifyEmailRequest req,
			@AuthenticationPrincipal AuthenticatedUser principal
	) {
		emailVerification.verify(principal.getUserId(), req.code());
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/send-verification-code")
	public ResponseEntity<Void> sendVerificationCode(@AuthenticationPrincipal AuthenticatedUser principal) {
		emailVerification.sendCode(principal.getUserId());
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/refresh")
	public AuthResponse refresh(@Valid @RequestBody RefreshRequest req) {
		return authService.refresh(req);
	}

	@PostMapping("/logout")
	public ResponseEntity<Void> logout(@AuthenticationPrincipal AuthenticatedUser principal) {
		authService.logout(principal.getUserId(), principal.getSessionId());
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/activity")
	public ResponseEntity<Void> activity(@AuthenticationPrincipal AuthenticatedUser principal) {
		if (!sessionService.touch(principal.getSessionId(), principal.getUserId())) {
			return ResponseEntity.status(401).build();
		}
		return ResponseEntity.noContent().build();
	}
}
