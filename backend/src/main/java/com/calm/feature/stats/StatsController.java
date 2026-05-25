package com.calm.feature.stats;

import com.calm.security.AuthenticatedUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/stats")
public class StatsController {

	private final StatsService statsService;

	public StatsController(StatsService statsService) {
		this.statsService = statsService;
	}

	@GetMapping
	public StatsResponse getSummary(
			@RequestParam(defaultValue = "month") String period,
			@AuthenticationPrincipal AuthenticatedUser principal) {
		return statsService.compute(principal.getUserId(), period);
	}
}
