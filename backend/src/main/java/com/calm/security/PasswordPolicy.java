package com.calm.security;

import com.calm.common.exception.ApiException;
import org.springframework.http.HttpStatus;
import java.nio.charset.StandardCharsets;

/** Keep registration, password changes and recovery consistent with BCrypt's byte limit. */
public final class PasswordPolicy {
    private PasswordPolicy() {}
    public static void validate(String password) {
        if (password == null || !password.matches("(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}")) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Пароль должен содержать не менее 8 символов, строчную и заглавную букву и цифру");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Пароль слишком длинный: максимум 72 байта UTF-8");
        }
    }
}
