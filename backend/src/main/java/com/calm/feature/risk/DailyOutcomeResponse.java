package com.calm.feature.risk;

import java.time.LocalDate;

public record DailyOutcomeResponse(LocalDate date, Status status, boolean headachePresent,
		boolean dayCompleted, String outcomeDefinition) {
	public enum Status { ATTACK_STARTED, NO_ATTACK_STARTED, UNKNOWN }
}
