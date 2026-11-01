package com.calm.feature.admin;

import com.calm.common.exception.ConflictException;
import com.calm.feature.risk.SharedModelParticipationService;
import com.calm.feature.user.AccountDeletionService;
import com.calm.feature.user.UserRepository;
import com.calm.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class AdminUserControllerTest {

	@Test
	void adminCanDeleteAnotherAccount() {
		UserRepository users = mock(UserRepository.class);
		SharedModelParticipationService participation = mock(SharedModelParticipationService.class);
		AccountDeletionService deletion = mock(AccountDeletionService.class);
		AdminUserController controller = new AdminUserController(users, participation, deletion);

		var response = controller.delete("target-id", new AuthenticatedUser("admin-id", "admin@example.test", "ADMIN", "session"));

		assertEquals(204, response.getStatusCode().value());
		verify(deletion).deleteAccount("target-id");
		verifyNoInteractions(users, participation);
	}

	@Test
	void adminCannotDeleteOwnAccount() {
		UserRepository users = mock(UserRepository.class);
		SharedModelParticipationService participation = mock(SharedModelParticipationService.class);
		AccountDeletionService deletion = mock(AccountDeletionService.class);
		AdminUserController controller = new AdminUserController(users, participation, deletion);

		assertThrows(ConflictException.class, () -> controller.delete("admin-id",
				new AuthenticatedUser("admin-id", "admin@example.test", "ADMIN", "session")));
		verifyNoInteractions(users, participation, deletion);
	}
    @Test
    void changingRoleCannotOverwritePasswordFromAStaleUserObject() {
        UserRepository users = mock(UserRepository.class);
        var target = new com.calm.feature.user.User("target@example.test", "Target", "old-password-hash");
        target.setId("target");
        org.mockito.Mockito.when(users.findById("target")).thenReturn(java.util.Optional.of(target));
        var controller = new AdminUserController(users, mock(SharedModelParticipationService.class), mock(AccountDeletionService.class));
        controller.changeRole("target", new com.calm.feature.admin.dto.UpdateRoleRequest(com.calm.feature.user.Role.ADMIN),
                new AuthenticatedUser("admin", "admin@example.test", "ADMIN", "session"));
        verify(users).updateRole("target", com.calm.feature.user.Role.ADMIN);
        org.mockito.Mockito.verify(users, org.mockito.Mockito.never()).save(org.mockito.ArgumentMatchers.any());
    }
}
