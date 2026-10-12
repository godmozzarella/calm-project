package com.calm.common.exception;

import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@RestControllerAdvice
public class GlobalExceptionHandler {
	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

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

	@ExceptionHandler(ResponseStatusException.class)
	public ResponseEntity<ErrorResponse> handleStatus(ResponseStatusException e) {
		int status = e.getStatusCode().value();
		HttpStatus known = HttpStatus.resolve(status);
		return ResponseEntity.status(e.getStatusCode())
				.body(ErrorResponse.of(status, known == null ? "Request failed" : known.getReasonPhrase(),
						e.getReason() == null ? "Запрос отклонён" : e.getReason()));
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

	@ExceptionHandler(ConstraintViolationException.class)
	public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException e) {
		List<String> details = e.getConstraintViolations().stream()
				.map(v -> v.getPropertyPath() + ": " + v.getMessage())
				.toList();
		return ResponseEntity
				.badRequest()
				.body(new ErrorResponse(Instant.now(), 400, "Bad Request", "Ошибка валидации", details));
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException e) {
		return ResponseEntity
				.badRequest()
				.body(ErrorResponse.of(400, "Bad Request", "Некорректный формат тела запроса"));
	}

	@ExceptionHandler(MissingServletRequestParameterException.class)
	public ResponseEntity<ErrorResponse> handleMissingParam(MissingServletRequestParameterException e) {
		return ResponseEntity
				.badRequest()
				.body(ErrorResponse.of(400, "Bad Request", "Отсутствует обязательный параметр: " + e.getParameterName()));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ErrorResponse> handleFallback(Exception e) {
		log.error("Необработанная ошибка запроса", e);
		return ResponseEntity
				.internalServerError()
				.body(ErrorResponse.of(500, "Internal Server Error", "Внутренняя ошибка сервера"));
	}
}
