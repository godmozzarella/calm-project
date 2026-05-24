package com.calm.feature.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
		@Size(min = 1, max = 64) String name,
		@Email String email,
		String avatarUrl,
		// Опционально: смена пароля. Нужен текущий + новый.
		String currentPassword,
		@Size(min = 8, max = 128) String newPassword
) {}
