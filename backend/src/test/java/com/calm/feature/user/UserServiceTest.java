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
	@Mock org.springframework.data.mongodb.core.MongoTemplate mongo;

	@Test
	void newAccountIsNeverAdminBasedOnUnverifiedEmail() {
		UserService service = new UserService(users, passwords, sessions, mongo);
		when(passwords.encode("StrongPassword123")).thenReturn("hash");
		when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
		User created = service.create(" Admin@Example.COM ", "New user", "StrongPassword123");
		assertThat(created.getEmail()).isEqualTo("admin@example.com");
		assertThat(created.getRole()).isEqualTo(Role.USER);
	}

	@Test
	void duplicateEmailIsCheckedAfterNormalization() {
		UserService service = new UserService(users, passwords, sessions, mongo);
		when(users.existsByEmail("user@example.com")).thenReturn(true);
		assertThatThrownBy(() -> service.create(" USER@EXAMPLE.COM ", "Name", "StrongPassword123"))
				.isInstanceOf(ConflictException.class);
		verify(users, never()).save(any());
	}

    @Test
    void legacyProfilePatchCannotChangeSecurityFields() {
        UserService service = new UserService(users, passwords, sessions, mongo);
        User user = new User("user@example.com", "Name", "old-hash");
        when(users.findById("user-1")).thenReturn(Optional.of(user));
        service.update("user-1", new UpdateUserRequest(null, "attacker@example.com", null,
                "old-pass", "new-password", null, null, null, null));
        assertThat(user.getPasswordHash()).isEqualTo("old-hash");
        assertThat(user.getEmail()).isEqualTo("user@example.com");
        verifyNoInteractions(mongo, sessions, passwords);
        verify(users, never()).save(any());
    }
}
