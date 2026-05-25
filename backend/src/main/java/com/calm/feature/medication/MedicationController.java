package com.calm.feature.medication;

import com.calm.feature.medication.dto.MedicationDto;
import com.calm.feature.medication.dto.MedicationRequest;
import com.calm.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/medications")
public class MedicationController {

	private final MedicationService service;

	public MedicationController(MedicationService service) {
		this.service = service;
	}

	@GetMapping
	public List<MedicationDto> list(
			@AuthenticationPrincipal AuthenticatedUser principal,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
	) {
		List<Medication> list = (from != null && to != null)
				? service.listInRange(principal.getUserId(), from, to)
				: service.listForUser(principal.getUserId());
		return list.stream().map(MedicationDto::from).toList();
	}

	@GetMapping("/{id}")
	public MedicationDto get(@AuthenticationPrincipal AuthenticatedUser principal, @PathVariable String id) {
		return MedicationDto.from(service.getOwned(principal.getUserId(), id));
	}

	@PostMapping
	public ResponseEntity<MedicationDto> create(
			@AuthenticationPrincipal AuthenticatedUser principal,
			@Valid @RequestBody MedicationRequest req
	) {
		Medication m = service.create(principal.getUserId(), req);
		return ResponseEntity.status(HttpStatus.CREATED).body(MedicationDto.from(m));
	}

	@PutMapping("/{id}")
	public MedicationDto update(
			@AuthenticationPrincipal AuthenticatedUser principal,
			@PathVariable String id,
			@Valid @RequestBody MedicationRequest req
	) {
		return MedicationDto.from(service.update(principal.getUserId(), id, req));
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser principal, @PathVariable String id) {
		service.delete(principal.getUserId(), id);
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/overuse")
	public Map<String, Integer> overuseDaysInMonth(
			@AuthenticationPrincipal AuthenticatedUser principal,
			@RequestParam int year,
			@RequestParam int month
	) {
		int days = service.overuseDaysInMonth(principal.getUserId(), year, month);
		return Map.of("days", days);
	}
}
