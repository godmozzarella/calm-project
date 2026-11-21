package com.calm.feature.admin;

import com.calm.feature.attack.AttackRepository;
import com.calm.feature.attack.AttackRepository.DailyCount;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/admin/stats/attacks")
public class AdminAttackStatsController {

	private static final int MAX_DAYS = 5 * 366;
	private static final LocalDate EARLIEST_DATE = LocalDate.of(1, 1, 1);
	private final AttackRepository attacks;

	public AdminAttackStatsController(AttackRepository attacks) {
		this.attacks = attacks;
	}

	@GetMapping
	public List<DailyCount> countByDay(@RequestParam(required = false) String from, @RequestParam String to,
			@RequestParam(defaultValue = "UTC") String timezone) {
		LocalDate first;
		LocalDate last;
		ZoneId zone;
		try {
			first = from == null ? null : LocalDate.parse(from);
			last = LocalDate.parse(to);
			zone = ZoneId.of(timezone);
		} catch (DateTimeException ignored) {
			throw invalid("Проверьте даты и часовой пояс.");
		}
		if (last.isBefore(EARLIEST_DATE) || last.getYear() > 9999
				|| first != null && (first.isBefore(EARLIEST_DATE) || last.isBefore(first))) {
			throw invalid("Выберите корректный диапазон дат.");
		}
		if (first != null && ChronoUnit.DAYS.between(first, last) >= MAX_DAYS) {
			throw invalid("Выберите период не длиннее 1830 дней.");
		}

		LocalDate until = last.plusDays(1);
		ZoneId mongoZone = zone.normalized();
		LocalDate lowerBound = first == null ? EARLIEST_DATE : first;
		var counts = attacks.countAddedByDay(lowerBound.atStartOfDay(zone).toInstant(), until.atStartOfDay(zone).toInstant(),
				mongoZone.equals(ZoneOffset.UTC) ? "UTC" : mongoZone.getId());
		var byDate = counts.stream().collect(Collectors.toMap(DailyCount::date, DailyCount::count));
		LocalDate firstDay = first == null
				? byDate.keySet().stream().min(String::compareTo).map(LocalDate::parse).orElse(last)
				: first;
		return firstDay.datesUntil(until).map(date -> date.toString())
				.map(date -> new DailyCount(date, byDate.getOrDefault(date, 0L))).toList();
	}

	private static ResponseStatusException invalid(String message) {
		return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
	}
}
