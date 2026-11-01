package com.calm.feature.auth;

import com.calm.feature.auth.dto.AuthResponse;
import com.calm.feature.auth.dto.LoginRequest;
import com.calm.feature.auth.dto.RefreshRequest;
import com.calm.feature.auth.dto.RegisterRequest;
import com.calm.feature.auth.dto.RegistrationCodeRequest;
import com.calm.feature.auth.dto.RegistrationResendRequest;
import com.calm.feature.auth.dto.RegistrationStartedResponse;
import com.calm.feature.auth.dto.VerifyEmailRequest;
import com.calm.feature.auth.dto.PasswordResetRequest;
import com.calm.feature.auth.dto.PasswordResetConfirmRequest;
import com.calm.feature.auth.dto.PasswordResetVerifyRequest;
import com.calm.feature.user.AccountSecurityService;
import com.calm.feature.user.dto.CancelEmailChangeRequest;
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
	private final AccountSecurityService accountSecurity;

	public AuthController(AuthService authService, AuthSessionService sessionService,
			EmailVerificationService emailVerification, AccountSecurityService accountSecurity) {
		this.authService = authService;
		this.sessionService = sessionService;
		this.emailVerification = emailVerification;
		this.accountSecurity = accountSecurity;
	}

	@PostMapping("/register")
	public RegistrationStartedResponse register(@Valid @RequestBody RegisterRequest req) {
		var user = authService.registerPending(req);
		try {
			int resendAfterSeconds = emailVerification.startRegistration(user.getId());
			return new RegistrationStartedResponse(user.getEmail(), resendAfterSeconds);
		} catch (RuntimeException error) {
			authService.discardPendingRegistration(user.getId());
			throw error;
		}
	}

	@PostMapping("/verify-registration")
	public AuthResponse verifyRegistration(@Valid @RequestBody RegistrationCodeRequest req) {
		var pending = authService.authenticatePendingRegistration(req.email(), req.password());
		var verified = emailVerification.verify(pending.getId(), req.code());
		return authService.issueTokenPair(verified);
	}

	@PostMapping("/resend-registration-code")
	public ResponseEntity<Void> resendRegistrationCode(@Valid @RequestBody RegistrationResendRequest req) {
		var pending = authService.authenticatePendingRegistration(req.email(), req.password());
		emailVerification.sendCode(pending.getId());
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/cancel-registration")
	public ResponseEntity<Void> cancelRegistration(@Valid @RequestBody RegistrationResendRequest req) {
		var pending = authService.authenticatePendingRegistration(req.email(), req.password());
		authService.discardPendingRegistration(pending.getId());
		return ResponseEntity.noContent().build();
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

	@PostMapping("/cancel-email-change")
	public ResponseEntity<Void> cancelEmailChange(@RequestBody CancelEmailChangeRequest req) {
		accountSecurity.cancelEmailChangeByToken(req.token());
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/password-reset/request")
	public ResponseEntity<Void> requestPasswordReset(@Valid @RequestBody PasswordResetRequest req) {
		accountSecurity.requestPasswordReset(req.email());
		return ResponseEntity.noContent().build();
	}

    @PostMapping("/password-reset/verify")
    public ResponseEntity<java.util.Map<String, String>> verifyPasswordReset(@Valid @RequestBody PasswordResetVerifyRequest req) {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
                .body(java.util.Map.of("verificationToken", accountSecurity.verifyPasswordReset(req.email(), req.code())));
    }

	@PostMapping("/password-reset/confirm")
	public ResponseEntity<Void> confirmPasswordReset(@Valid @RequestBody PasswordResetConfirmRequest req) {
		accountSecurity.resetPassword(req.email(), req.verificationToken(), req.newPassword());
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
