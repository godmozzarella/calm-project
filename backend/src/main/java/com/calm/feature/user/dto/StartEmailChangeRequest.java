package com.calm.feature.user.dto;

import jakarta.validation.constraints.Email;

public record StartEmailChangeRequest(String currentPassword, @Email String newEmail) {}
