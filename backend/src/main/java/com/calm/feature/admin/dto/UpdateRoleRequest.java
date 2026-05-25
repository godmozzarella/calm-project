package com.calm.feature.admin.dto;

import com.calm.feature.user.Role;
import jakarta.validation.constraints.NotNull;

public record UpdateRoleRequest(@NotNull Role role) {}
