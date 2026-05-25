package com.calm.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit-тесты для {@link JwtService}: проверяем выпуск, парсинг и валидацию подписи.
 * Используем валидный секрет ≥ 32 байт, как требует конструктор.
 */
class JwtServiceTest {

	private static final String VALID_SECRET = "unit-test-secret-please-only-for-tests-32bytes-min";
	private static final String OTHER_SECRET = "another-unit-test-secret-32bytes-or-more-please-ok";

	@Test
	@DisplayName("Конструктор: короткий секрет (<32 байт) вызывает IllegalStateException")
	void constructor_shortSecretThrows() {
		assertThatThrownBy(() -> new JwtService("short", 60))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("at least 32 bytes");
	}

	@Test
	@DisplayName("issue → parse: токен содержит правильные subject/email/role")
	void issueAndParse_roundtrip() {
		JwtService svc = new JwtService(VALID_SECRET, 60);

		String token = svc.issue("user-42", "kirill@test.com", "USER");
		Claims claims = svc.parse(token);

		assertThat(claims.getSubject()).isEqualTo("user-42");
		assertThat(claims.get("email", String.class)).isEqualTo("kirill@test.com");
		assertThat(claims.get("role", String.class)).isEqualTo("USER");
	}

	@Test
	@DisplayName("Токен подписанный одним ключом не парсится другим (защита от подделки)")
	void parse_wrongKey_throws() {
		JwtService issuer = new JwtService(VALID_SECRET, 60);
		JwtService verifier = new JwtService(OTHER_SECRET, 60);

		String token = issuer.issue("user-42", "kirill@test.com", "USER");

		assertThatThrownBy(() -> verifier.parse(token))
				.isInstanceOf(SignatureException.class);
	}

	@Test
	@DisplayName("Срок жизни токена: expiration > issuedAt и совпадает с TTL")
	void issue_expirationMatchesTtl() {
		JwtService svc = new JwtService(VALID_SECRET, 30);

		Claims claims = svc.parse(svc.issue("u", "e", "USER"));

		long ttlMs = claims.getExpiration().getTime() - claims.getIssuedAt().getTime();
		assertThat(ttlMs).isEqualTo(30 * 60 * 1000L);
	}
}
