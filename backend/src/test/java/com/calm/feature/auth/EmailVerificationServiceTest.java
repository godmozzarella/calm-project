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
import org.springframework.web.server.ResponseStatusException;

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

	@Test
	void sendsSingleUseLinkAndVerifiesAddress() {
		EmailVerificationService service = new EmailVerificationService(users, email, "https://calm.example");
		User user = new User("user@example.com", "User", "hash");
		when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
		when(email.send(eq("user@example.com"), any(), any())).thenReturn(EmailSendResult.SENT);
		assertThat(service.sendInitial(user)).isTrue();
		ArgumentCaptor<String> html = ArgumentCaptor.forClass(String.class);
		verify(email).send(eq("user@example.com"), any(), html.capture());
		Matcher matcher = Pattern.compile("#token=([A-Za-z0-9_-]{43})").matcher(html.getValue());
		assertThat(matcher.find()).isTrue();
		String token = matcher.group(1);
		assertThat(user.getEmailVerificationTokenHash()).hasSize(64).doesNotContain(token);
		when(users.findByEmailVerificationTokenHash(user.getEmailVerificationTokenHash()))
				.thenReturn(Optional.of(user));
		service.verify(token);
		assertThat(user.isEmailVerified()).isTrue();
		assertThat(user.getEmailVerificationTokenHash()).isNull();
	}

	@Test
	void explainsResendTestModeRecipientRestriction() {
		EmailVerificationService service = new EmailVerificationService(users, email, "https://calm.example");
		User user = new User("new-user@example.com", "User", "hash");
		user.setId("new-user-id");
		when(users.findById("new-user-id")).thenReturn(Optional.of(user));
		when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
		when(email.send(eq("new-user@example.com"), any(), any())).thenReturn(EmailSendResult.RECIPIENT_RESTRICTED);

		assertThatThrownBy(() -> service.resend("new-user-id"))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("подтвердить домен отправителя в Resend");
	}

	@Test
	void badTokenIsRejectedBeforeDatabaseLookup() {
		EmailVerificationService service = new EmailVerificationService(users, email, "https://calm.example");
		assertThatThrownBy(() -> service.verify("short"))
				.isInstanceOf(ResponseStatusException.class);
		verifyNoInteractions(users);
	}
}
