package com.calm.feature.user;

import com.calm.feature.user.dto.UpdateUserRequest;
import com.calm.feature.user.dto.UserDto;
import com.calm.feature.user.dto.ChangePasswordRequest;
import com.calm.feature.user.dto.StartEmailChangeRequest;
import com.calm.feature.user.dto.EmailChangeCodeRequest;
import com.calm.feature.user.dto.EmailChangeStatus;
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
	private final AccountSecurityService accountSecurityService;

	public UserController(UserService userService, AccountDeletionService accountDeletionService,
			AccountSecurityService accountSecurityService) {
		this.userService = userService;
		this.accountDeletionService = accountDeletionService;
		this.accountSecurityService = accountSecurityService;
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

	@PostMapping("/me/password")
	public ResponseEntity<Void> changePassword(
			@AuthenticationPrincipal AuthenticatedUser principal,
			@RequestBody ChangePasswordRequest req
	) {
		accountSecurityService.changePassword(principal.getUserId(), req.currentPassword(), req.newPassword());
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/me/email-change")
	public EmailChangeStatus emailChangeStatus(@AuthenticationPrincipal AuthenticatedUser principal) {
		return accountSecurityService.getEmailChangeStatus(principal.getUserId());
	}

	@PostMapping("/me/email-change")
	public EmailChangeStatus startEmailChange(
			@AuthenticationPrincipal AuthenticatedUser principal,
			@Valid @RequestBody StartEmailChangeRequest req
	) {
		return accountSecurityService.startEmailChange(principal.getUserId(), req.currentPassword(), req.newEmail());
	}

	@PostMapping("/me/email-change/resend")
	public EmailChangeStatus resendEmailChangeCode(@AuthenticationPrincipal AuthenticatedUser principal) {
		return accountSecurityService.resendEmailChangeCode(principal.getUserId());
	}

	@PostMapping("/me/email-change/confirm")
	public ResponseEntity<Void> confirmEmailChange(
			@AuthenticationPrincipal AuthenticatedUser principal,
			@RequestBody EmailChangeCodeRequest req
	) {
		accountSecurityService.confirmEmailChange(principal.getUserId(), req.code());
		return ResponseEntity.noContent().build();
	}

	@DeleteMapping("/me/email-change")
	public ResponseEntity<Void> cancelEmailChange(@AuthenticationPrincipal AuthenticatedUser principal) {
		accountSecurityService.cancelEmailChange(principal.getUserId());
		return ResponseEntity.noContent().build();
	}

	@DeleteMapping("/me")
	public ResponseEntity<Void> deleteMe(@AuthenticationPrincipal AuthenticatedUser principal) {
		accountDeletionService.deleteAccount(principal.getUserId());
		return ResponseEntity.noContent().build();
	}
}
