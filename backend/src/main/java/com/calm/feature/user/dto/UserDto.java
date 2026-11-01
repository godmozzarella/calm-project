package com.calm.feature.user.dto;

import com.calm.feature.user.Role;
import com.calm.feature.user.User;

import java.time.Instant;

public record UserDto(
		String id,
		String email,
		boolean emailVerified,
		String name,
		Role role,
		String avatarUrl,
		Double latitude,
		Double longitude,
		String city,
		boolean notificationsEnabled,
		Instant createdAt,
        String locationMode, String locationTimezone, long locationVersion
) {
	public static UserDto from(User u) {
		return new UserDto(
				u.getId(),
				u.getEmail(),
				u.isEmailVerified(),
				u.getName(),
				u.getRole(),
				u.getAvatarUrl(),
				u.getLatitude(),
				u.getLongitude(),
				u.getCity(),
				u.isNotificationsEnabled(),
				u.getCreatedAt(), u.getLocationMode(), u.getLocationTimezone(), u.getLocationVersion()
		);
	}
}
