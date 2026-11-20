package com.calm.feature.auth.dto;

import com.calm.feature.user.dto.UserDto;

public record AuthResponse(String token, UserDto user) {}
