package com.calm.feature.risk;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

/** Явно подтверждённый день без нового начала приступа. */
@Document(collection = "risk_daily_outcomes")
@CompoundIndex(name = "user_date_unique", def = "{'userId': 1, 'date': 1}", unique = true)
public class DailyOutcome {
	@Id
	private String id;
	private String userId;
	private LocalDate date;
	private Instant confirmedAt;

	public DailyOutcome() {}

	public DailyOutcome(String userId, LocalDate date, Instant confirmedAt) {
		this.userId = userId;
		this.date = date;
		this.confirmedAt = confirmedAt;
	}

	public String getId() { return id; }
	public String getUserId() { return userId; }
	public LocalDate getDate() { return date; }
	public Instant getConfirmedAt() { return confirmedAt; }
}
