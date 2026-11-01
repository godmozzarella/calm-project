package com.calm.feature.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegistrationCodeRequest(
		@Email @NotBlank String email,
		@NotBlank @Size(max = 128) String password,
		@NotBlank @Pattern(regexp = "\\d{4}") String code
) {}
