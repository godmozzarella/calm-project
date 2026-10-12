package com.calm.feature.risk;

import com.calm.security.AuthenticatedUser;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/risk")
public class RiskPredictionController {

	private final RiskPredictionService service;
	private final RiskQualityService qualityService;
	private final DailyOutcomeService dailyOutcomeService;
	private final SharedModelParticipationService participationService;

	public RiskPredictionController(RiskPredictionService service, RiskQualityService qualityService,
			DailyOutcomeService dailyOutcomeService, SharedModelParticipationService participationService) {
		this.service = service;
		this.qualityService = qualityService;
		this.dailyOutcomeService = dailyOutcomeService;
		this.participationService = participationService;
	}

	@GetMapping("/today")
	public RiskPredictionResponse today(@AuthenticationPrincipal AuthenticatedUser principal) {
		return service.predictToday(principal.getUserId());
	}

	@GetMapping
	public RiskPredictionResponse byDate(
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
			@AuthenticationPrincipal AuthenticatedUser principal) {
		return service.predict(principal.getUserId(), date);
	}

	@GetMapping("/quality")
	public RiskQualityResponse quality(@AuthenticationPrincipal AuthenticatedUser principal) {
		return qualityService.evaluate(principal.getUserId());
	}

	@GetMapping("/outcome")
	public DailyOutcomeResponse outcome(
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
			@AuthenticationPrincipal AuthenticatedUser principal) {
		return dailyOutcomeService.get(principal.getUserId(), date);
	}

	@PostMapping("/outcome/no-attack")
	public DailyOutcomeResponse confirmNoAttack(@AuthenticationPrincipal AuthenticatedUser principal,
			@RequestBody ConfirmNoAttackRequest request) {
		return dailyOutcomeService.confirmNoAttack(principal.getUserId(), request.date(), request.timezone());
	}

	@DeleteMapping("/outcome")
	public DailyOutcomeResponse clearOutcome(
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
			@AuthenticationPrincipal AuthenticatedUser principal) {
		return dailyOutcomeService.clear(principal.getUserId(), date);
	}

	public record ConfirmNoAttackRequest(LocalDate date, String timezone) {}

	@GetMapping("/participation")
	public SharedModelParticipationResponse participation(@AuthenticationPrincipal AuthenticatedUser principal) {
		return participationService.get(principal.getUserId());
	}

	@PostMapping("/participation")
	public SharedModelParticipationResponse grantParticipation(@AuthenticationPrincipal AuthenticatedUser principal,
			@RequestBody ConsentRequest request) {
		return participationService.grant(principal.getUserId(), request.consentVersion(), request.consentDigest());
	}

	@PostMapping("/participation/decline")
	public SharedModelParticipationResponse declineParticipation(@AuthenticationPrincipal AuthenticatedUser principal,
			@RequestBody ConsentRequest request) {
		return participationService.decline(principal.getUserId(), request.consentVersion(), request.consentDigest());
	}

	public record ConsentRequest(String consentVersion, String consentDigest) {}

	@DeleteMapping("/participation")
	public SharedModelParticipationResponse withdrawParticipation(@AuthenticationPrincipal AuthenticatedUser principal) {
		return participationService.withdraw(principal.getUserId());
	}
}
