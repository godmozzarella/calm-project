package com.calm.feature.auth;

import com.calm.feature.email.EmailService;
import com.calm.feature.email.EmailSendResult;
import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailVerificationServiceTest {
	@Mock UserRepository users;
	@Mock EmailService email;
	@Mock PasswordEncoder passwordEncoder;

	@Test
	void sendsFourDigitCodeAndVerifiesTheAuthenticatedUser() {
		EmailVerificationService service = new EmailVerificationService(users, email, passwordEncoder);
		User user = new User("user@example.com", "User", "hash");
		user.setId("user-1");
		when(users.findById("user-1")).thenReturn(Optional.of(user));
		when(email.send(eq("user@example.com"), any(), any())).thenReturn(EmailSendResult.SENT);
		when(passwordEncoder.encode(any())).thenAnswer(inv -> "encoded:" + inv.getArgument(0));
		when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

		service.sendCode("user-1");

		ArgumentCaptor<String> html = ArgumentCaptor.forClass(String.class);
		verify(email).send(eq("user@example.com"), any(), html.capture());
		Matcher matcher = Pattern.compile("<strong>(\\d{4})</strong>").matcher(html.getValue());
		assertThat(matcher.find()).isTrue();
		String code = matcher.group(1);
		assertThat(user.getEmailVerificationCodeHash()).isEqualTo("encoded:" + code);
		assertThat(user.getEmailVerificationExpiresAt()).isAfter(Instant.now());
		assertThat(user.getEmailVerificationSentAt()).isNotNull();

		when(users.findById("user-1")).thenReturn(Optional.of(user));
		when(passwordEncoder.matches(code, "encoded:" + code)).thenReturn(true);
		service.verify("user-1", code);
		assertThat(user.isEmailVerified()).isTrue();
		assertThat(user.getEmailVerificationCodeHash()).isNull();
	}

	@Test
	void successfulResendReplacesPreviousCodeAndResetsAttempts() {
		EmailVerificationService service = new EmailVerificationService(users, email, passwordEncoder);
		User user = new User("user@example.com", "User", "hash");
		user.setId("user-1");
		user.setEmailVerificationCodeHash("old-hash");
		user.setEmailVerificationSentAt(Instant.now().minusSeconds(31));
		user.setEmailVerificationAttempts(3);
		when(users.findById("user-1")).thenReturn(Optional.of(user));
		when(email.send(eq("user@example.com"), any(), any())).thenReturn(EmailSendResult.SENT);
		when(passwordEncoder.encode(any())).thenAnswer(inv -> "encoded:" + inv.getArgument(0));
		when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

		service.sendCode("user-1");

		assertThat(user.getEmailVerificationCodeHash()).startsWith("encoded:").isNotEqualTo("old-hash");
		assertThat(user.getEmailVerificationAttempts()).isZero();
	}

	@Test
	void resendIsRejectedWithinThirtySeconds() {
		EmailVerificationService service = new EmailVerificationService(users, email, passwordEncoder);
		User user = new User("user@example.com", "User", "hash");
		user.setId("user-1");
		user.setEmailVerificationSentAt(Instant.now());
		when(users.findById("user-1")).thenReturn(Optional.of(user));

		assertThatThrownBy(() -> service.sendCode("user-1"))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("Повторно отправить код можно через");
		verifyNoInteractions(email);
	}

	@Test
	void malformedCodeIsRejectedBeforeDatabaseLookup() {
		EmailVerificationService service = new EmailVerificationService(users, email, passwordEncoder);
		assertThatThrownBy(() -> service.verify("user-1", "short"))
				.isInstanceOf(ResponseStatusException.class);
		verifyNoInteractions(users);
	}
}
