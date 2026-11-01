package com.calm.feature.user.dto;

public record ChangePasswordRequest(String currentPassword, String newPassword) {}
