package com.calm.feature.risk;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

@DataMongoTest
@ActiveProfiles("test")
class DailyOutcomeRepositoryTest {
	@Autowired private DailyOutcomeRepository outcomes;

	@Test
	void rangeIncludesBothBoundaryDatesAndOnlyRequestedUser() {
		LocalDate first = LocalDate.of(2026, 10, 18);
		LocalDate last = first.plusDays(1);
		outcomes.save(new DailyOutcome("user-1", first, Instant.now()));
		outcomes.save(new DailyOutcome("user-1", last, Instant.now()));
		outcomes.save(new DailyOutcome("user-2", last, Instant.now()));

		assertThat(outcomes.findByUserIdAndDateBetween("user-1", first, first))
				.extracting(DailyOutcome::getDate).containsExactly(first);
		assertThat(outcomes.findByUserIdAndDateBetween("user-1", first, last))
				.extracting(DailyOutcome::getDate).containsExactlyInAnyOrder(first, last);
	}
}
