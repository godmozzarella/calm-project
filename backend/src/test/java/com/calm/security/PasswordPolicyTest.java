package com.calm.security;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class PasswordPolicyTest {
    @Test void specialCharacterIsOptionalButMixedCaseAndDigitsAreRequired() {
        assertThatCode(() -> PasswordPolicy.validate("StrongPassword123")).doesNotThrowAnyException();
        assertThatThrownBy(() -> PasswordPolicy.validate("weakpass123")).hasMessageContaining("строчную и заглавную");
    }
    @Test void enforcesBcryptLimitInBytesIncludingMultibytePasswords() {
        assertThatThrownBy(() -> PasswordPolicy.validate("Strong1" + "я".repeat(34))).hasMessageContaining("72 байта");
        assertThatCode(() -> PasswordPolicy.validate("Strong1" + "я".repeat(32))).doesNotThrowAnyException();
    }
}
