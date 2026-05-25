package com.calm.feature.user.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
		@Size(min = 1, max = 64) String name,
		@Email String email,
		String avatarUrl,
		// Опционально: смена пароля. Нужен текущий + новый.
		String currentPassword,
		@Size(min = 8, max = 128) String newPassword,
		// Локация для прогноза. Передаются все три вместе при выборе города на онбординге
		// либо обнуляются (null) если пользователь сбрасывает локацию.
		@DecimalMin("-90") @DecimalMax("90") Double latitude,
		@DecimalMin("-180") @DecimalMax("180") Double longitude,
		@Size(max = 100) String city,
		Boolean notificationsEnabled
) {}
