package com.calm.feature.stats;

import com.calm.feature.attack.Attack;
import com.calm.feature.attack.AttackRepository;
import com.calm.feature.medication.Medication;
import com.calm.feature.medication.MedicationRepository;
import com.calm.feature.stats.StatsResponse.*;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class StatsService {

	private static final int OVERUSE_THRESHOLD = 10;
	private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ISO_LOCAL_DATE;

	private static final Map<String, String> TRIGGER_LABELS = Map.of(
			"stress", "Стресс", "sleep", "Сон", "food", "Еда",
			"weather", "Погода", "screen", "Экран", "hormones", "Гормоны", "alcohol", "Алкоголь");

	private static final Map<String, String> SYMPTOM_LABELS = Map.of(
			"nausea", "Тошнота", "light", "Светобоязнь", "sound", "Звукобоязнь",
			"aura", "Аура", "dizziness", "Головокружение");

	private static final String[] MONTHS_SHORT =
			{"янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"};

	private final AttackRepository attackRepo;
	private final MedicationRepository medicationRepo;

	public StatsService(AttackRepository attackRepo, MedicationRepository medicationRepo) {
		this.attackRepo = attackRepo;
		this.medicationRepo = medicationRepo;
	}

	public StatsResponse compute(String userId, String period) {
		LocalDate today = LocalDate.now();
		DateRange range = resolveRange(userId, period, today);

		List<Attack> attacks = attackRepo.findInRange(userId, range.from(), range.to())
				.stream()
				.filter(a -> a.getStartDate() != null
						&& !a.getStartDate().isBefore(range.from())
						&& !a.getStartDate().isAfter(range.to()))
				.toList();

		List<Medication> meds = medicationRepo.findInRange(userId, range.from(), range.to());

		LocalDate firstOfMonth = today.withDayOfMonth(1);
		List<Medication> thisMonthMeds = medicationRepo.findInRange(userId, firstOfMonth, today);

		List<BucketDto> buckets = buildBuckets(range, attacks);
		KpisDto kpis = computeKpis(attacks, buckets, thisMonthMeds, range);
		PatternsDto patterns = computePatterns(attacks, meds, range);

		return new StatsResponse(kpis, buckets, patterns);
	}

	// ── Range resolution ──────────────────────────────────────────────────────

	private DateRange resolveRange(String userId, String period, LocalDate today) {
		return switch (period) {
			case "week"    -> new DateRange(today.minusDays(6), today, "day");
			case "month"   -> new DateRange(today.minusDays(29), today, "day");
			case "3months" -> new DateRange(today.minusDays(89), today, "day");
			case "year"    -> new DateRange(today.minusDays(7 * 52 - 1), today, "week");
			case "all"     -> {
				Optional<LocalDate> earliest = attackRepo.findInRange(userId, LocalDate.of(2000, 1, 1), today)
						.stream()
						.map(Attack::getStartDate)
						.filter(Objects::nonNull)
						.min(Comparator.naturalOrder());
				LocalDate from = earliest.orElse(today.minusDays(29));
				long days = ChronoUnit.DAYS.between(from, today) + 1;
				String g = days <= 60 ? "day" : days <= 730 ? "week" : "month";
				yield new DateRange(from, today, g);
			}
			default -> new DateRange(today.minusDays(29), today, "day");
		};
	}

	private record DateRange(LocalDate from, LocalDate to, String granularity) {}

	// ── Bucket building ───────────────────────────────────────────────────────

	private List<BucketDto> buildBuckets(DateRange range, List<Attack> attacks) {
		Map<LocalDate, BucketAccum> byStart = attacks.stream().collect(
				Collectors.groupingBy(Attack::getStartDate, Collectors.collectingAndThen(
						Collectors.toList(),
						list -> {
							int count = list.size();
							int maxI = list.stream().mapToInt(Attack::getIntensity).max().orElse(0);
							return new BucketAccum(count, maxI);
						})));

		return switch (range.granularity()) {
			case "week"  -> makeWeekBuckets(range.from(), range.to(), byStart);
			case "month" -> makeMonthBuckets(range.from(), range.to(), byStart);
			default      -> makeDayBuckets(range.from(), range.to(), byStart);
		};
	}

	private List<BucketDto> makeDayBuckets(LocalDate from, LocalDate to,
	                                        Map<LocalDate, BucketAccum> byDate) {
		List<BucketDto> buckets = new ArrayList<>();
		LocalDate cur = from;
		while (!cur.isAfter(to)) {
			String key = cur.format(DATE_FMT);
			BucketAccum acc = byDate.getOrDefault(cur, BucketAccum.EMPTY);
			buckets.add(new BucketDto(key, String.valueOf(cur.getDayOfMonth()), key, key, key,
					acc.count(), acc.maxIntensity()));
			cur = cur.plusDays(1);
		}
		return buckets;
	}

	private List<BucketDto> makeWeekBuckets(LocalDate from, LocalDate to,
	                                         Map<LocalDate, BucketAccum> byDate) {
		// Align start to Monday
		LocalDate start = from;
		int dow = start.getDayOfWeek().getValue() - 1; // Mon=0
		start = start.minusDays(dow);

		List<BucketDto> buckets = new ArrayList<>();
		LocalDate cur = start;
		while (!cur.isAfter(to)) {
			LocalDate weekEnd = cur.plusDays(6);
			String fromKey = cur.format(DATE_FMT);
			String toKey = weekEnd.format(DATE_FMT);
			String label = cur.getDayOfMonth() + " " + MONTHS_SHORT[cur.getMonthValue() - 1];

			int count = 0; int maxI = 0;
			for (LocalDate d = cur; !d.isAfter(weekEnd); d = d.plusDays(1)) {
				BucketAccum acc = byDate.get(d);
				if (acc != null) { count += acc.count(); maxI = Math.max(maxI, acc.maxIntensity()); }
			}
			buckets.add(new BucketDto(fromKey, label, fromKey, toKey, null, count, maxI));
			cur = cur.plusWeeks(1);
		}
		return buckets;
	}

	private List<BucketDto> makeMonthBuckets(LocalDate from, LocalDate to,
	                                          Map<LocalDate, BucketAccum> byDate) {
		List<BucketDto> buckets = new ArrayList<>();
		LocalDate cur = from.withDayOfMonth(1);
		while (!cur.isAfter(to)) {
			LocalDate monthEnd = cur.withDayOfMonth(cur.lengthOfMonth());
			String fromKey = cur.format(DATE_FMT);
			String toKey = monthEnd.format(DATE_FMT);
			String label = MONTHS_SHORT[cur.getMonthValue() - 1];

			int count = 0; int maxI = 0;
			for (LocalDate d = cur; !d.isAfter(monthEnd); d = d.plusDays(1)) {
				BucketAccum acc = byDate.get(d);
				if (acc != null) { count += acc.count(); maxI = Math.max(maxI, acc.maxIntensity()); }
			}
			buckets.add(new BucketDto(fromKey, label, fromKey, toKey, null, count, maxI));
			cur = cur.plusMonths(1);
		}
		return buckets;
	}

	private record BucketAccum(int count, int maxIntensity) {
		static final BucketAccum EMPTY = new BucketAccum(0, 0);
	}

	// ── KPIs ──────────────────────────────────────────────────────────────────

	private KpisDto computeKpis(List<Attack> attacks, List<BucketDto> buckets,
	                             List<Medication> thisMonthMeds, DateRange range) {
		int total = attacks.size();

		double avgIntensity = attacks.stream()
				.mapToInt(Attack::getIntensity)
				.filter(i -> i > 0)
				.average()
				.orElse(0.0);

		int streak = longestStreak(attacks, range.from(), range.to());

		Set<LocalDate> overuseDates = thisMonthMeds.stream()
				.map(Medication::getDate)
				.filter(Objects::nonNull)
				.collect(Collectors.toSet());
		int overuseDays = overuseDates.size();
		boolean overuseRisk = overuseDays >= OVERUSE_THRESHOLD;

		return new KpisDto(total, Math.round(avgIntensity * 10.0) / 10.0, streak, overuseDays, overuseRisk);
	}

	private int longestStreak(List<Attack> attacks, LocalDate from, LocalDate to) {
		Set<LocalDate> painDays = attacks.stream()
				.map(Attack::getStartDate)
				.filter(Objects::nonNull)
				.collect(Collectors.toSet());

		int best = 0, run = 0;
		for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
			if (painDays.contains(d)) { run = 0; } else { run++; if (run > best) best = run; }
		}
		return best;
	}

	// ── Patterns ──────────────────────────────────────────────────────────────

	private PatternsDto computePatterns(List<Attack> attacks, List<Medication> meds, DateRange range) {
		return new PatternsDto(
				topTags(attacks, "triggers", TRIGGER_LABELS, 5),
				topTags(attacks, "symptoms", SYMPTOM_LABELS, 5),
				zonePatterns(attacks),
				medStats(meds));
	}

	private List<TagCountDto> topTags(List<Attack> attacks, String field,
	                                   Map<String, String> labels, int n) {
		Map<String, Integer> counts = new LinkedHashMap<>();
		for (Attack a : attacks) {
			Set<String> values = "triggers".equals(field) ? a.getTriggers() : a.getSymptoms();
			if (values == null) continue;
			for (String v : values) counts.merge(v, 1, Integer::sum);
		}
		int total = attacks.size();
		return counts.entrySet().stream()
				.map(e -> new TagCountDto(e.getKey(), labels.getOrDefault(e.getKey(), e.getKey()),
						e.getValue(), total > 0 ? (double) e.getValue() / total : 0))
				.sorted(Comparator.comparingInt(TagCountDto::count).reversed())
				.limit(n)
				.toList();
	}

	private ZonesDto zonePatterns(List<Attack> attacks) {
		Map<String, Integer> freq = new LinkedHashMap<>();
		for (Attack a : attacks) {
			if (a.getPainZones() == null) continue;
			Set<String> seen = new HashSet<>();
			for (String zone : a.getPainZones().keySet()) {
				if (seen.add(zone)) freq.merge(zone, 1, Integer::sum);
			}
		}
		int max = freq.values().stream().mapToInt(Integer::intValue).max().orElse(0);
		Map<String, String> colorMap = new LinkedHashMap<>();
		if (max > 0) {
			for (Map.Entry<String, Integer> e : freq.entrySet()) {
				double r = (double) e.getValue() / max;
				colorMap.put(e.getKey(), r >= 0.66 ? "red" : r >= 0.33 ? "yellow" : "green");
			}
		}
		return new ZonesDto(freq, colorMap, max);
	}

	private List<MedStatDto> medStats(List<Medication> meds) {
		Map<String, MedAccum> byName = new LinkedHashMap<>();
		for (Medication m : meds) {
			if (m.getName() == null) continue;
			MedAccum acc = byName.computeIfAbsent(m.getName(), k -> new MedAccum());
			acc.count++;
			if (m.getEffectiveness() != null) { acc.effSum += m.getEffectiveness(); acc.effCount++; }
		}
		return byName.entrySet().stream()
				.map(e -> {
					MedAccum a = e.getValue();
					Double avg = a.effCount > 0 ? Math.round((double) a.effSum / a.effCount * 10.0) / 10.0 : null;
					return new MedStatDto(e.getKey(), a.count, avg, a.effCount);
				})
				.sorted(Comparator.comparingInt(MedStatDto::count).reversed())
				.toList();
	}

	private static class MedAccum {
		int count, effSum, effCount;
	}
}
