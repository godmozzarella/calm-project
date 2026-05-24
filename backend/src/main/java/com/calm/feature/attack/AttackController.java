package com.calm.feature.attack;

import com.calm.feature.attack.dto.AttackDto;
import com.calm.feature.attack.dto.AttackRequest;
import com.calm.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/attacks")
public class AttackController {

	private final AttackService service;

	public AttackController(AttackService service) {
		this.service = service;
	}

	@GetMapping
	public List<AttackDto> list(
			@AuthenticationPrincipal AuthenticatedUser principal,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
	) {
		List<Attack> list = (from != null && to != null)
				? service.listInRange(principal.getUserId(), from, to)
				: service.listForUser(principal.getUserId());
		return list.stream().map(AttackDto::from).toList();
	}

	@GetMapping("/{id}")
	public AttackDto get(@AuthenticationPrincipal AuthenticatedUser principal, @PathVariable String id) {
		return AttackDto.from(service.getOwned(principal.getUserId(), id));
	}

	@PostMapping
	public ResponseEntity<AttackDto> create(
			@AuthenticationPrincipal AuthenticatedUser principal,
			@Valid @RequestBody AttackRequest req
	) {
		Attack a = service.create(principal.getUserId(), req);
		return ResponseEntity.status(HttpStatus.CREATED).body(AttackDto.from(a));
	}

	@PutMapping("/{id}")
	public AttackDto update(
			@AuthenticationPrincipal AuthenticatedUser principal,
			@PathVariable String id,
			@Valid @RequestBody AttackRequest req
	) {
		return AttackDto.from(service.update(principal.getUserId(), id, req));
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser principal, @PathVariable String id) {
		service.delete(principal.getUserId(), id);
		return ResponseEntity.noContent().build();
	}
}
