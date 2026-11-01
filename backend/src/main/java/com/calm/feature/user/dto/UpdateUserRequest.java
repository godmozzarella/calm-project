package com.calm.feature.user.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
		@Size(min = 1, max = 64) String name,
		// Legacy fields retained for request compatibility; UserService deliberately ignores them.
		String email,
		String avatarUrl,
		String currentPassword,
		String newPassword,
		// Локация для прогноза. Передаются все три вместе при выборе города на онбординге
		// либо обнуляются (null) если пользователь сбрасывает локацию.
		@DecimalMin("-90") @DecimalMax("90") Double latitude,
		@DecimalMin("-180") @DecimalMax("180") Double longitude,
		@Size(max = 100) String city,
		Boolean notificationsEnabled,
        @jakarta.validation.constraints.Pattern(regexp = "MANUAL|AUTO") String locationMode,
        @Size(max = 64) String locationTimezone,
        Long expectedLocationVersion,
        Boolean automaticLocationUpdate
) {
    public UpdateUserRequest(String name, String email, String avatarUrl, String currentPassword, String newPassword,
            Double latitude, Double longitude, String city, Boolean notificationsEnabled) {
        this(name, email, avatarUrl, currentPassword, newPassword, latitude, longitude, city, notificationsEnabled,
                null, null, null, null);
    }
}
