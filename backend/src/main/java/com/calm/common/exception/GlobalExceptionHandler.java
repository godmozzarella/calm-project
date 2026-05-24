package com.calm.common.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.List;

@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(ApiException.class)
	public ResponseEntity<ErrorResponse> handleApi(ApiException e) {
		return ResponseEntity
				.status(e.getStatus())
				.body(ErrorResponse.of(e.getStatus().value(), e.getStatus().getReasonPhrase(), e.getMessage()));
	}

	@ExceptionHandler(BadCredentialsException.class)
	public ResponseEntity<ErrorResponse> handleBadCreds(BadCredentialsException e) {
		return ResponseEntity
				.status(HttpStatus.UNAUTHORIZED)
				.body(ErrorResponse.of(401, "Unauthorized", "Неверный email или пароль"));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
		List<String> details = e.getBindingResult().getFieldErrors().stream()
				.map(f -> f.getField() + ": " + f.getDefaultMessage())
				.toList();
		return ResponseEntity
				.badRequest()
				.body(new ErrorResponse(Instant.now(), 400, "Bad Request", "Ошибка валидации", details));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ErrorResponse> handleFallback(Exception e) {
		return ResponseEntity
				.internalServerError()
				.body(ErrorResponse.of(500, "Internal Server Error", e.getMessage()));
	}
}
