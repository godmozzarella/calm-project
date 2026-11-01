package com.calm.feature.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegistrationResendRequest(
		@Email @NotBlank String email,
		@NotBlank @Size(max = 128) String password
) {}
