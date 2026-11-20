package com.calm.feature.user;

import com.calm.feature.user.dto.UpdateUserRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import java.util.Optional;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {
	@Mock UserRepository users;
	@Mock org.springframework.data.mongodb.core.MongoTemplate mongo;

	@Test
	void newlyConfirmedAddressCreatesVerifiedUserWithoutPassword() {
		UserService service = new UserService(users, mongo);
		when(users.insert(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
		User created = service.confirmEmailLogin("admin@example.com");
		assertThat(created.getEmail()).isEqualTo("admin@example.com");
		assertThat(created.getRole()).isEqualTo(Role.USER);
		assertThat(created.isEmailVerified()).isTrue();
		assertThat(created.getPasswordHash()).isNull();
	}

    @Test
    void legacyProfilePatchCannotChangeSecurityFields() {
        UserService service = new UserService(users, mongo);
        User user = new User("user@example.com", "Name", "old-hash");
        when(users.findById("user-1")).thenReturn(Optional.of(user));
        service.update("user-1", new UpdateUserRequest(null, "attacker@example.com", null,
                "old-pass", "new-password", null, null, null, null));
        assertThat(user.getPasswordHash()).isEqualTo("old-hash");
        assertThat(user.getEmail()).isEqualTo("user@example.com");
        verifyNoInteractions(mongo);
        verify(users, never()).save(any());
    }
}
