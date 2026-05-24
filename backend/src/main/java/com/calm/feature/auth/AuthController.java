package com.calm.feature.auth;

import com.calm.feature.auth.dto.AuthResponse;
import com.calm.feature.auth.dto.LoginRequest;
import com.calm.feature.auth.dto.RegisterRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {

	private final AuthService authService;

	public AuthController(AuthService authService) {
		this.authService = authService;
	}

	@PostMapping("/register")
	public AuthResponse register(@Valid @RequestBody RegisterRequest req) {
		return authService.register(req);
	}

	@PostMapping("/login")
	public AuthResponse login(@Valid @RequestBody LoginRequest req) {
		return authService.login(req);
	}
}
