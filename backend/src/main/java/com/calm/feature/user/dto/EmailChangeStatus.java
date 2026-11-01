package com.calm.feature.user.dto;

import java.time.Instant;

public record EmailChangeStatus(boolean active, String pendingEmail, int resendAfterSeconds, Instant expiresAt) {}
