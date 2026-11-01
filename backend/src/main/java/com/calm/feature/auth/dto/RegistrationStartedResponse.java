package com.calm.feature.auth.dto;

public record RegistrationStartedResponse(String email, int resendAfterSeconds) {}
