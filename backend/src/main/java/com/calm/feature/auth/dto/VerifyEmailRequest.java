package com.calm.feature.auth.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotBlank;

public record VerifyEmailRequest(@NotBlank @Pattern(regexp = "\\d{4}") String code) {}
