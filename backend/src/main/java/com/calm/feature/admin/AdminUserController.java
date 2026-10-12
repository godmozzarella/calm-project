package com.calm.feature.admin;

import com.calm.common.exception.ConflictException;
import com.calm.common.exception.NotFoundException;
import com.calm.feature.admin.dto.UpdateRoleRequest;
import com.calm.feature.risk.SharedModelParticipationResponse;
import com.calm.feature.risk.SharedModelParticipationService;
import com.calm.feature.user.Role;
import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import com.calm.feature.user.AccountDeletionService;
import com.calm.feature.user.dto.UserDto;
import com.calm.security.AuthenticatedUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Stream;

/**
 * Эндпоинты для админа. Все защищены ролью ADMIN через {@code /admin/**} в SecurityConfig.
 */
@RestController
@RequestMapping("/admin/users")
public class AdminUserController {

	private final UserRepository userRepository;
	private final SharedModelParticipationService participationService;
	private final AccountDeletionService accountDeletionService;

	public AdminUserController(UserRepository userRepository, SharedModelParticipationService participationService,
			AccountDeletionService accountDeletionService) {
		this.userRepository = userRepository;
		this.participationService = participationService;
		this.accountDeletionService = accountDeletionService;
	}

	/** Администратор может удалить любой другой аккаунт, но не свою текущую учётную запись. */
	@DeleteMapping("/{id}")
	public org.springframework.http.ResponseEntity<Void> delete(
			@PathVariable String id,
			@AuthenticationPrincipal AuthenticatedUser current) {
		if (id.equals(current.getUserId())) {
			throw new ConflictException("Нельзя удалить собственный аккаунт из панели администратора");
		}
		accountDeletionService.deleteAccount(id);
		return org.springframework.http.ResponseEntity.noContent().build();
	}

	/** Список всех пользователей. Поддерживает поиск по подстроке email/имени. */
	@GetMapping
	public List<UserDto> list(@RequestParam(required = false) String q) {
		Stream<User> all = userRepository.findAll().stream();
		if (q != null && !q.isBlank()) {
			String needle = q.toLowerCase().trim();
			all = all.filter(u ->
					(u.getEmail() != null && u.getEmail().toLowerCase().contains(needle)) ||
					(u.getName() != null  && u.getName().toLowerCase().contains(needle))
			);
		}
		return all.map(UserDto::from).toList();
	}

	/**
	 * Сменить роль пользователю.
	 * <p>Защита: админ не может разжаловать сам себя — иначе можно остаться без админов вообще.
	 */
	@PatchMapping("/{id}/role")
	public UserDto changeRole(
			@PathVariable String id,
			@Valid @RequestBody UpdateRoleRequest req,
			@AuthenticationPrincipal AuthenticatedUser current
	) {
		User target = userRepository.findById(id)
				.orElseThrow(() -> new NotFoundException("Пользователь не найден"));

		if (req.role() != Role.ADMIN && id.equals(current.getUserId())) {
			throw new ConflictException("Нельзя снять с себя роль администратора");
		}

		target.setRole(req.role());
		User saved = userRepository.save(target);
		return UserDto.from(saved);
	}

	@GetMapping("/{id}/shared-model-participation")
	public SharedModelParticipationResponse getSharedModelParticipation(@PathVariable String id) {
		if (!userRepository.existsById(id)) throw new NotFoundException("Пользователь не найден");
		return participationService.get(id);
	}

	@PatchMapping("/{id}/shared-model-participation")
	public SharedModelParticipationResponse setSharedModelParticipation(@PathVariable String id,
			@Valid @RequestBody AdminParticipationRequest req,
			@AuthenticationPrincipal AuthenticatedUser current) {
		if (!userRepository.existsById(id)) throw new NotFoundException("Пользователь не найден");
		return participationService.setAdminBlocked(id, current.getUserId(), req.blocked());
	}

	public record AdminParticipationRequest(@NotNull Boolean blocked) {}
}
