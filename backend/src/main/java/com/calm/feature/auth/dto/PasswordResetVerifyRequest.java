package com.calm.feature.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record PasswordResetVerifyRequest(@NotBlank @Email String email, String code) {}
