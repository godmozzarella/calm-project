package com.calm.feature.user.dto;

import com.calm.feature.user.User;

import java.time.Instant;

public record UserDto(
		String id,
		String email,
		String name,
		String avatarUrl,
		Instant createdAt
) {
	public static UserDto from(User u) {
		return new UserDto(u.getId(), u.getEmail(), u.getName(), u.getAvatarUrl(), u.getCreatedAt());
	}
}
