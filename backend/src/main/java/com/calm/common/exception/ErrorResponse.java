package com.calm.common.exception;

import java.time.Instant;
import java.util.List;

public record ErrorResponse(
		Instant timestamp,
		int status,
		String error,
		String message,
		List<String> details
) {
	public static ErrorResponse of(int status, String error, String message) {
		return new ErrorResponse(Instant.now(), status, error, message, null);
	}
}
