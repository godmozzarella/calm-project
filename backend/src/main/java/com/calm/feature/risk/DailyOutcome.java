package com.calm.feature.risk;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

/** Версионированная отметка: новый смысл — отсутствие новых начал, старые документы — отсутствие боли. */
@Document(collection = "risk_daily_outcomes")
@CompoundIndex(name = "user_date_unique", def = "{'userId': 1, 'date': 1}", unique = true)
public class DailyOutcome {
	@Id
	private String id;
	private String userId;
	private LocalDate date;
	private Instant confirmedAt;
	private String outcomeDefinition;
	private String timezone;
	public static final String NEW_START_DEFINITION = "new-attack-onset-local-day-v1";

	public static DailyOutcome noNewAttack(String userId, LocalDate date, Instant markedAt, String timezone) {
		DailyOutcome mark = new DailyOutcome(userId, date, markedAt);
		mark.outcomeDefinition = NEW_START_DEFINITION;
		mark.timezone = timezone;
		return mark;
	}

	public void remark(Instant markedAt, String timezone) {
		this.confirmedAt = markedAt;
		this.timezone = timezone;
		this.outcomeDefinition = NEW_START_DEFINITION;
	}

	public String getOutcomeDefinition() { return outcomeDefinition; }
	public String getTimezone() { return timezone; }

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
