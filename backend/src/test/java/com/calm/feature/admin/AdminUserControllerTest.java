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
}
