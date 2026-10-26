package com.calm.feature.medication;

import com.calm.feature.medication.dto.MedicationDto;
import com.calm.feature.medication.dto.MedicationRequest;
import com.calm.feature.medication.dto.PersonalMedicationDto;
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
import java.util.stream.Collectors;

@RestController
@RequestMapping("/medications")
public class MedicationController {

	private final MedicationService service;
	private final PersonalMedicationService personalService;

	public MedicationController(MedicationService service, PersonalMedicationService personalService) {
		this.service = service;
		this.personalService = personalService;
	}

	@GetMapping("/personal")
	public List<PersonalMedicationDto> personal(@AuthenticationPrincipal AuthenticatedUser principal) {
		return service.listPersonal(principal.getUserId()).stream().map(PersonalMedicationDto::from).toList();
	}

	@DeleteMapping("/personal/{id}")
	public ResponseEntity<Void> deletePersonal(
			@AuthenticationPrincipal AuthenticatedUser principal, @PathVariable String id) {
		personalService.archive(principal.getUserId(), id);
		return ResponseEntity.noContent().build();
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
		Map<String, String> personalNames = personalService.list(principal.getUserId()).stream()
				.collect(Collectors.toMap(PersonalMedication::getId, PersonalMedication::getName));
		return list.stream().map(m -> MedicationDto.from(m,
				personalNames.getOrDefault(m.getPersonalMedicationId(), m.getName()))).toList();
	}

	@GetMapping("/{id}")
	public MedicationDto get(@AuthenticationPrincipal AuthenticatedUser principal, @PathVariable String id) {
		Medication medication = service.getOwned(principal.getUserId(), id);
		return MedicationDto.from(medication, service.displayName(principal.getUserId(), medication));
	}

	@PostMapping
	public ResponseEntity<MedicationDto> create(
			@AuthenticationPrincipal AuthenticatedUser principal,
			@Valid @RequestBody MedicationRequest req
	) {
		Medication m = service.create(principal.getUserId(), req);
		return ResponseEntity.status(HttpStatus.CREATED)
				.body(MedicationDto.from(m, service.displayName(principal.getUserId(), m)));
	}

	@PutMapping("/{id}")
	public MedicationDto update(
			@AuthenticationPrincipal AuthenticatedUser principal,
			@PathVariable String id,
			@Valid @RequestBody MedicationRequest req
	) {
		Medication medication = service.update(principal.getUserId(), id, req);
		return MedicationDto.from(medication, service.displayName(principal.getUserId(), medication));
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
