package com.calm.feature.risk;

import com.calm.feature.attack.Attack;
import com.calm.feature.attack.AttackRepository;
import com.calm.feature.dictionary.DictionaryEntry;
import com.calm.feature.dictionary.DictionaryRepository;
import com.calm.feature.dictionary.DictionaryType;
import com.calm.feature.forecast.ForecastService;
import com.calm.feature.forecast.dto.ForecastDayDto;
import com.calm.feature.forecast.snapshot.ForecastSnapshot;
import com.calm.feature.forecast.snapshot.ForecastSnapshotService;
import com.calm.feature.medication.Medication;
import com.calm.feature.medication.MedicationRepository;
import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class RiskPredictionService {
	private static final Logger log = LoggerFactory.getLogger(RiskPredictionService.class);

	private static final int MIN_HISTORY_DAYS_FOR_PERSONAL = 30;
	private static final int MIN_ATTACK_DAYS_FOR_PERSONAL = 5;
	private static final int FEATURE_SCHEMA_VERSION = 2;
	private static final String SCORING_VERSION = "personal-rules-v1";
	private static final int MOH_THRESHOLD_TRIPTAN_OPIOID = 10;
	private static final int MOH_THRESHOLD_SIMPLE_NSAID = 15;

	private final UserRepository userRepo;
	private final AttackRepository attackRepo;
	private final MedicationRepository medicationRepo;
	private final DictionaryRepository dictionaryRepo;
	private final ForecastSnapshotService snapshotService;
	private final ForecastService forecastService;
	private final RiskPredictionRecordRepository predictionRecordRepo;

	public RiskPredictionService(
			UserRepository userRepo,
			AttackRepository attackRepo,
			MedicationRepository medicationRepo,
			DictionaryRepository dictionaryRepo,
			ForecastSnapshotService snapshotService,
			ForecastService forecastService,
			RiskPredictionRecordRepository predictionRecordRepo) {
		this.userRepo = userRepo;
		this.attackRepo = attackRepo;
		this.medicationRepo = medicationRepo;
		this.dictionaryRepo = dictionaryRepo;
		this.snapshotService = snapshotService;
		this.forecastService = forecastService;
		this.predictionRecordRepo = predictionRecordRepo;
	}

	public RiskPredictionResponse predictToday(String userId) {
		User user = userRepo.findById(userId).orElse(null);
		if (user == null || user.getLatitude() == null || user.getLongitude() == null) {
			return unavailable(LocalDate.now(), "Укажи город, чтобы рассчитать персональный риск.");
		}
		try {
			List<ForecastDayDto> days = forecastService.getForecast(user.getLatitude(), user.getLongitude()).days();
			if (!days.isEmpty()) return predict(userId, days.get(0).date());
		} catch (RuntimeException ignored) {
			// predict ниже может использовать сохранённый снимок.
		}
		return predict(userId, LocalDate.now());
	}

	public RiskPredictionResponse predict(String userId, LocalDate date) {
		User user = userRepo.findById(userId).orElse(null);
		if (user == null || user.getLatitude() == null || user.getLongitude() == null) {
			return unavailable(date, "Укажи город, чтобы рассчитать персональный риск.");
		}

		Optional<WeatherDay> weather = weatherFor(user, date);
		if (weather.isEmpty()) {
			return unavailable(date, "Для выбранной даты пока нет погодных данных.");
		}

		LocalDate historyFrom = date.minusDays(90);
		List<Attack> historyAttacks = attackRepo.findInRange(userId, historyFrom, date.minusDays(1));
		List<Medication> recentMeds = medicationRepo.findInRange(userId, date.minusDays(30), date.minusDays(1));
		Set<LocalDate> attackDays = datesOf(historyAttacks);
		Set<LocalDate> medicationDays = recentMeds.stream()
				.map(Medication::getDate)
				.filter(Objects::nonNull)
				.collect(Collectors.toSet());

		List<String> reasons = new ArrayList<>();
		List<String> personalFactors = new ArrayList<>();
		WeatherDay w = weather.get();
		int score = clamp(w.score());
		if (score > 0) reasons.add("Погодный риск: " + score + " из 100");

		int attacksLast3 = countDatesBetween(attackDays, date.minusDays(3), date.minusDays(1));
		int attacksLast7 = countDatesBetween(attackDays, date.minusDays(7), date.minusDays(1));
		int medsLast7 = countDatesBetween(medicationDays, date.minusDays(7), date.minusDays(1));
		boolean overuseRisk = computeOveruseRisk(recentMeds, date);

		if (attackDays.contains(date.minusDays(1))) {
			score += 15;
			reasons.add("Приступ был вчера");
		}
		if (attacksLast3 >= 2) {
			score += 10;
			reasons.add("Несколько приступов за последние 3 дня");
		}
		if (attacksLast7 >= 3) {
			int add = Math.min(12, attacksLast7 * 3);
			score += add;
			reasons.add("Частые приступы за последнюю неделю");
		}
		if (medsLast7 >= 3) {
			score += 6;
			reasons.add("Частый приём препаратов за последние 7 дней");
		}
		if (overuseRisk) {
			score += 10;
			reasons.add("Есть сигнал риска medication overuse");
		}

		PersonalCalibration personal = personalCalibration(user, date, w, personalFactors);
		score += personal.scoreModifier();
		score = clamp(score);

		String historyLevel = historyLevel(personal.historyDays(), personal.historyAttackDays());
		RiskPredictionResponse result = new RiskPredictionResponse(
				date,
				score,
				levelOf(score),
				historyLevel,
				true,
				null,
				reasons,
				personalFactors,
				new RiskPredictionResponse.RiskInputs(
						w.score(),
						w.pressureHpa(),
						w.pressureDelta24h(),
						w.humidity(),
						w.tempMin(),
						w.tempMax(),
						w.windKmhMax(),
						w.kpIndex(),
						attacksLast3,
						attacksLast7,
						medsLast7,
						overuseRisk,
						personal.historyDays(),
						personal.historyAttackDays()
				)
		);
		recordFuturePrediction(userId, date, w.timezone(), result, historyAttacks);
		return result;
	}

	private void recordFuturePrediction(String userId, LocalDate date, String timezone,
			RiskPredictionResponse result, List<Attack> historyAttacks) {
		if (timezone == null || timezone.isBlank()) return;
		try {
			ZoneId zone = ZoneId.of(timezone);
			Instant now = Instant.now();
			if (!now.isBefore(date.atStartOfDay(zone).toInstant())) return;
			RiskHistoryFeatures historyFeatures = RiskHistoryFeatures.from(
					historyAttacks, date, LocalDate.ofInstant(now, zone));
			predictionRecordRepo.save(new RiskPredictionRecord(userId, date, now,
					timezone, result.score(), result.level(), FEATURE_SCHEMA_VERSION, SCORING_VERSION,
					RiskFeatureSnapshot.from(result.inputs(), historyFeatures)));
		} catch (RuntimeException e) {
			log.warn("Не удалось сохранить оценку для проверки качества, userId={}, date={}: {}",
					userId, date, e.getMessage());
		}
	}

	private Optional<WeatherDay> weatherFor(User user, LocalDate date) {
		try {
			Optional<WeatherDay> forecastDay = forecastService.getForecast(user.getLatitude(), user.getLongitude()).days().stream()
					.filter(d -> d.date().equals(date))
					.findFirst()
					.map(WeatherDay::from);
			if (forecastDay.isPresent()) return forecastDay;
		} catch (RuntimeException ignored) {
			// При ошибке прогноза используем сохранённый снимок на выбранную дату.
		}
		return snapshotService.findInRange(user.getLatitude(), user.getLongitude(), date, date).stream()
				.findFirst()
				.map(WeatherDay::from);
	}

	private PersonalCalibration personalCalibration(User user, LocalDate date, WeatherDay current,
			List<String> personalFactors) {
		LocalDate from = date.minusDays(90);
		List<ForecastSnapshot> snapshots = snapshotService.findInRange(
				user.getLatitude(), user.getLongitude(), from, date.minusDays(1));
		if (snapshots.isEmpty()) return new PersonalCalibration(0, 0, 0);

		Set<LocalDate> attackDays = datesOf(attackRepo.findInRange(user.getId(), from, date.minusDays(1)));
		int historyAttackDays = countDatesBetween(attackDays, from, date.minusDays(1));
		if (snapshots.size() < MIN_HISTORY_DAYS_FOR_PERSONAL || historyAttackDays < MIN_ATTACK_DAYS_FOR_PERSONAL) {
			return new PersonalCalibration(0, snapshots.size(), historyAttackDays);
		}

		int modifier = 0;
		modifier += compareFactor(
				current.pressureDelta24h() == null ? null : Math.abs(current.pressureDelta24h()),
				snapshots,
				attackDays,
				s -> s.getPressureDelta24h() == null ? null : Math.abs(s.getPressureDelta24h()),
				1.5,
				"У тебя приступы чаще совпадали с резкими перепадами давления",
				personalFactors);
		modifier += compareFactor(
				current.humidity(),
				snapshots,
				attackDays,
				ForecastSnapshot::getHumidity,
				8.0,
				"У тебя приступы чаще совпадали с высокой влажностью",
				personalFactors);
		modifier += compareFactor(
				current.kpIndex(),
				snapshots,
				attackDays,
				ForecastSnapshot::getKpIndex,
				0.8,
				"У тебя приступы чаще совпадали с повышенным Kp-индексом",
				personalFactors);
		modifier += compareFactor(
				(double) current.score(),
				snapshots,
				attackDays,
				s -> (double) s.getScore(),
				10.0,
				"Похожие погодные дни раньше чаще совпадали с приступами",
				personalFactors);

		return new PersonalCalibration(Math.min(20, modifier), snapshots.size(), historyAttackDays);
	}

	private int compareFactor(Double current, List<ForecastSnapshot> snapshots, Set<LocalDate> attackDays,
			FactorReader reader, double minGap, String label, List<String> personalFactors) {
		if (current == null) return 0;
		AveragePair avg = averages(snapshots, attackDays, reader);
		if (avg.attackCount() < MIN_ATTACK_DAYS_FOR_PERSONAL || avg.freeCount() < 7) return 0;
		if (avg.attackAvg() - avg.freeAvg() < minGap) return 0;
		if (current < avg.attackAvg()) return 0;
		personalFactors.add(label);
		return 5;
	}

	private AveragePair averages(List<ForecastSnapshot> snapshots, Set<LocalDate> attackDays, FactorReader reader) {
		double attackSum = 0, freeSum = 0;
		int attackCount = 0, freeCount = 0;
		for (ForecastSnapshot snap : snapshots) {
			Double value = reader.read(snap);
			if (value == null) continue;
			if (attackDays.contains(snap.getDate())) {
				attackSum += value;
				attackCount++;
			} else {
				freeSum += value;
				freeCount++;
			}
		}
		return new AveragePair(
				attackCount == 0 ? 0 : attackSum / attackCount,
				freeCount == 0 ? 0 : freeSum / freeCount,
				attackCount,
				freeCount
		);
	}

	private boolean computeOveruseRisk(List<Medication> meds, LocalDate date) {
		LocalDate from = date.withDayOfMonth(1);
		List<Medication> monthMeds = meds.stream()
				.filter(m -> m.getDate() != null && !m.getDate().isBefore(from) && !m.getDate().isAfter(date))
				.toList();
		if (monthMeds.isEmpty()) return false;

		Map<String, String> nameToClass = dictionaryRepo
				.findByTypeOrderByOrderAscLabelAsc(DictionaryType.MEDICATION_PRESET).stream()
				.filter(e -> e.getCategory() != null && !e.getCategory().isBlank())
				.collect(Collectors.toMap(e -> e.getValue().toLowerCase(), DictionaryEntry::getCategory, (a, b) -> a));

		Map<String, Set<LocalDate>> daysByClass = new HashMap<>();
		for (Medication med : monthMeds) {
			String cls = resolveClass(med, nameToClass);
			if (cls == null || "preventive".equals(cls)) continue;
			daysByClass.computeIfAbsent(cls, k -> new HashSet<>()).add(med.getDate());
		}
		for (var entry : daysByClass.entrySet()) {
			int threshold = ("triptan".equals(entry.getKey()) || "opioid".equals(entry.getKey()))
					? MOH_THRESHOLD_TRIPTAN_OPIOID : MOH_THRESHOLD_SIMPLE_NSAID;
			if (entry.getValue().size() >= threshold) return true;
		}
		return false;
	}

	private static String resolveClass(Medication med, Map<String, String> nameToClass) {
		if (med.getTherapeuticClass() != null && !med.getTherapeuticClass().isBlank()) {
			return med.getTherapeuticClass();
		}
		if (med.getName() == null) return null;
		return nameToClass.get(med.getName().toLowerCase().trim());
	}

	private static Set<LocalDate> datesOf(List<Attack> attacks) {
		return attacks.stream().map(Attack::getStartDate).filter(Objects::nonNull).collect(Collectors.toSet());
	}

	private static int countDatesBetween(Set<LocalDate> dates, LocalDate from, LocalDate to) {
		if (to.isBefore(from)) return 0;
		int count = 0;
		for (LocalDate date : dates) {
			if (!date.isBefore(from) && !date.isAfter(to)) count++;
		}
		return count;
	}

	private static RiskPredictionResponse unavailable(LocalDate date, String message) {
		return new RiskPredictionResponse(
				date,
				0,
				RiskLevel.LOW,
				"LOW",
				false,
				message,
				List.of(),
				List.of(),
				new RiskPredictionResponse.RiskInputs(null, null, null, null, null, null, null, null,
						0, 0, 0, false, 0, 0)
		);
	}

	private static String historyLevel(int historyDays, int attackDays) {
		if (historyDays >= 60 && attackDays >= 10) return "HIGH";
		if (historyDays >= MIN_HISTORY_DAYS_FOR_PERSONAL && attackDays >= MIN_ATTACK_DAYS_FOR_PERSONAL) return "MEDIUM";
		return "LOW";
	}

	private static RiskLevel levelOf(int score) {
		if (score >= 65) return RiskLevel.HIGH;
		if (score >= 35) return RiskLevel.MEDIUM;
		return RiskLevel.LOW;
	}

	private static int clamp(int score) {
		return Math.max(0, Math.min(100, score));
	}

	private interface FactorReader {
		Double read(ForecastSnapshot snapshot);
	}

	private record AveragePair(double attackAvg, double freeAvg, int attackCount, int freeCount) {}
	private record PersonalCalibration(int scoreModifier, int historyDays, int historyAttackDays) {}

	private record WeatherDay(
			LocalDate date,
			int score,
			Double pressureHpa,
			Double pressureDelta24h,
			Double humidity,
			Double tempMin,
			Double tempMax,
			Double windKmhMax,
			Double kpIndex,
			String timezone
	) {
		static WeatherDay from(ForecastDayDto day) {
			return new WeatherDay(day.date(), day.score(), day.pressureHpa(), day.pressureDelta24h(),
					day.humidity(), day.tempMin(), day.tempMax(), day.windKmhMax(), day.kpIndex(), day.timezone());
		}

		static WeatherDay from(ForecastSnapshot snap) {
			return new WeatherDay(snap.getDate(), snap.getScore(), snap.getPressureHpa(), snap.getPressureDelta24h(),
				snap.getHumidity(), snap.getTempMin(), snap.getTempMax(), snap.getWindKmhMax(), snap.getKpIndex(), snap.getTimezone());
		}
	}
}
