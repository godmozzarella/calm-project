package com.calm.feature.admin;

import com.calm.common.exception.ConflictException;
import com.calm.common.exception.NotFoundException;
import com.calm.feature.admin.dto.UpdateRoleRequest;
import com.calm.feature.user.Role;
import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import com.calm.feature.user.dto.UserDto;
import com.calm.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
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

	public AdminUserController(UserRepository userRepository) {
		this.userRepository = userRepository;
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
}
