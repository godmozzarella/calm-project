package com.calm.feature.risk;

import java.time.LocalDate;

public record DailyOutcomeResponse(LocalDate date, Status status) {
	public enum Status { ATTACK_STARTED, NO_ATTACK_STARTED, UNKNOWN }
}
