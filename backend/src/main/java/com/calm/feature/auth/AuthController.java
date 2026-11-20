package com.calm.feature.auth;

import com.calm.feature.auth.dto.AuthResponse;
import com.calm.feature.user.AccountSecurityService;
import com.calm.feature.user.User;
import com.calm.feature.user.dto.CancelEmailChangeRequest;
import com.calm.security.AuthenticatedUser;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(value = "/auth", consumes = MediaType.APPLICATION_JSON_VALUE)
public class AuthController {
	private static final String COOKIE = "calm_session";
	private final AuthService auth;
	private final AuthSessionService sessions;
	private final EmailLoginService login;
	private final AccountSecurityService accountSecurity;
	private final boolean secure;

	public AuthController(AuthService auth, AuthSessionService sessions, EmailLoginService login,
			AccountSecurityService accountSecurity,
			@Value("${calm.auth.secure-cookie:true}") boolean secure) {
		this.auth = auth;
		this.sessions = sessions;
		this.login = login;
		this.accountSecurity = accountSecurity;
		this.secure = secure;
	}

	record LoginRequest(String email, String code, String token) {}
	record LegacyRefresh(String refreshToken) {}

	@PostMapping("/email/request")
	public ResponseEntity<Void> request(@RequestBody LoginRequest request) {
		login.send(request.email());
		return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
	}

	@PostMapping("/email/verify")
	public ResponseEntity<AuthResponse> verify(@RequestBody LoginRequest request) {
		return authenticated(login.verifyCode(request.email(), request.code()));
	}

	@PostMapping("/email/link")
	public ResponseEntity<AuthResponse> link(@RequestBody LoginRequest request) {
		return authenticated(login.verifyLink(request.token()));
	}

	@PostMapping("/cancel-email-change")
	public ResponseEntity<Void> cancelEmailChange(@RequestBody CancelEmailChangeRequest req) {
		accountSecurity.cancelEmailChangeByToken(req.token());
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/refresh")
	public ResponseEntity<AuthResponse> refresh(@CookieValue(name = COOKIE, required = false) String cookie,
			@RequestBody LegacyRefresh request) {
		String replacement = EmailLoginService.randomToken();
		AuthService.Refreshed refreshed = auth.refresh(cookie, request.refreshToken(), replacement);
		var result = ResponseEntity.ok().cacheControl(CacheControl.noStore());
		if (refreshed.migrated()) {
			result.header(HttpHeaders.SET_COOKIE, cookie(replacement, AuthSessionService.IDLE_LIMIT));
		}
		return result.body(refreshed.response());
	}

	@PostMapping("/logout")
	public ResponseEntity<Void> logout(@AuthenticationPrincipal AuthenticatedUser principal,
			@CookieValue(name = COOKIE, required = false) String cookie) {
		if (principal != null) sessions.revoke(principal.getSessionId(), principal.getUserId());
		if (AuthSessionService.validCookie(cookie)) {
			AuthSession session = sessions.findCookieSession(cookie);
			if (session != null) sessions.revoke(session.getId(), session.getUserId());
		}
		return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO)).build();
	}

	@PostMapping("/activity")
	public ResponseEntity<Void> activity(@AuthenticationPrincipal AuthenticatedUser principal,
			@CookieValue(name = COOKIE, required = false) String cookie) {
		if (!sessions.touch(principal.getSessionId(), principal.getUserId())) {
			return ResponseEntity.status(401).build();
		}
		var result = ResponseEntity.noContent();
		if (AuthSessionService.validCookie(cookie)) {
			AuthSession session = sessions.findCookieSession(cookie);
			if (session != null && principal.getSessionId().equals(session.getId())) {
				result.header(HttpHeaders.SET_COOKIE, cookie(cookie, AuthSessionService.IDLE_LIMIT));
			}
		}
		return result.build();
	}

	private ResponseEntity<AuthResponse> authenticated(User user) {
		String token = EmailLoginService.randomToken();
		return ResponseEntity.ok().cacheControl(CacheControl.noStore())
				.header(HttpHeaders.SET_COOKIE, cookie(token, AuthSessionService.IDLE_LIMIT))
				.body(auth.login(user, token));
	}

	private String cookie(String value, Duration age) {
		return ResponseCookie.from(COOKIE, value).httpOnly(true).secure(secure)
				.sameSite("Strict").path("/api/auth").maxAge(age).build().toString();
	}
}
