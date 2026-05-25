package com.calm.feature.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
		@Email @NotBlank String email,
		@NotBlank @Size(min = 1, max = 64) String name,
		@NotBlank @Size(min = 8, max = 128) String password
) {}
