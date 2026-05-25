package com.calm.feature.user;

import com.calm.feature.user.dto.UpdateUserRequest;
import com.calm.feature.user.dto.UserDto;
import com.calm.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
public class UserController {

	private final UserService userService;
	private final AccountDeletionService accountDeletionService;

	public UserController(UserService userService, AccountDeletionService accountDeletionService) {
		this.userService = userService;
		this.accountDeletionService = accountDeletionService;
	}

	@GetMapping("/me")
	public UserDto me(@AuthenticationPrincipal AuthenticatedUser principal) {
		return UserDto.from(userService.getById(principal.getUserId()));
	}

	@PatchMapping("/me")
	public UserDto updateMe(
			@AuthenticationPrincipal AuthenticatedUser principal,
			@Valid @RequestBody UpdateUserRequest req
	) {
		return UserDto.from(userService.update(principal.getUserId(), req));
	}

	@DeleteMapping("/me")
	public ResponseEntity<Void> deleteMe(@AuthenticationPrincipal AuthenticatedUser principal) {
		accountDeletionService.deleteAccount(principal.getUserId());
		return ResponseEntity.noContent().build();
	}
}
