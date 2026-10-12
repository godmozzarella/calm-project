package com.calm.feature.user;

import com.calm.common.exception.ConflictException;
import com.calm.feature.auth.AuthSessionRepository;
import com.calm.feature.user.dto.UpdateUserRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import java.util.Optional;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {
	@Mock UserRepository users;
	@Mock PasswordEncoder passwords;
	@Mock AuthSessionRepository sessions;

	@Test
	void newAccountIsNeverAdminBasedOnUnverifiedEmail() {
		UserService service = new UserService(users, passwords, sessions);
		when(passwords.encode("password123")).thenReturn("hash");
		when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
		User created = service.create(" Admin@Example.COM ", "New user", "password123");
		assertThat(created.getEmail()).isEqualTo("admin@example.com");
		assertThat(created.getRole()).isEqualTo(Role.USER);
	}

	@Test
	void duplicateEmailIsCheckedAfterNormalization() {
		UserService service = new UserService(users, passwords, sessions);
		when(users.existsByEmail("user@example.com")).thenReturn(true);
		assertThatThrownBy(() -> service.create(" USER@EXAMPLE.COM ", "Name", "password123"))
				.isInstanceOf(ConflictException.class);
		verify(users, never()).save(any());
	}

	@Test
	void passwordChangeRevokesExistingSessions() {
		UserService service = new UserService(users, passwords, sessions);
		User user = new User("user@example.com", "Name", "old-hash");
		when(users.findById("user-1")).thenReturn(Optional.of(user));
		when(passwords.matches("old-pass", "old-hash")).thenReturn(true);
		when(passwords.encode("new-password")).thenReturn("new-hash");
		when(users.save(user)).thenReturn(user);
		service.update("user-1", new UpdateUserRequest(null, null, null,
				"old-pass", "new-password", null, null, null, null));
		assertThat(user.getPasswordHash()).isEqualTo("new-hash");
		verify(sessions).deleteByUserId("user-1");
	}
}
