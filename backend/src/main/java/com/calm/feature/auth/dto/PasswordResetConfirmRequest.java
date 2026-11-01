package com.calm.feature.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record PasswordResetConfirmRequest(
		@NotBlank @Email String email,
		String verificationToken,
		String newPassword
) {}
