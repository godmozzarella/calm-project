import s from './WeatherCorrelationBlock.module.scss'

const MIN_DAYS_FOR_INSIGHT = 7

const formatShare = (part, total) => {
	if (!total) return '0%'
	return `${Math.round((part / total) * 100)}%`
}

const WeatherCorrelationBlock = ({ weather }) => {
	if (!weather) return null
	const {
		daysCovered = 0,
		attacksTotal = 0,
		attacksOnElevatedRisk = 0,
		avgRiskOnAttackDays,
		avgRiskOnPainFreeDays,
		avgPressureOnAttack,
		avgPressureOnPainFree,
	} = weather

	if (daysCovered === 0) {
		return (
			<section className={s.card}>
				<h3 className={s.title}>Погода и приступы</h3>
				<p className={s.empty}>
					Чтобы видеть корреляцию, укажите свой город в профиле — мы начнём
					сохранять ежедневные снимки погоды.
				</p>
			</section>
		)
	}

	if (daysCovered < MIN_DAYS_FOR_INSIGHT) {
		return (
			<section className={s.card}>
				<h3 className={s.title}>Погода и приступы</h3>
				<p className={s.empty}>
					Накапливаем данные: {daysCovered} {daysCovered === 1 ? 'день' : 'дн.'} с прогнозом погоды.
					Корреляция появится после {MIN_DAYS_FOR_INSIGHT} дней.
				</p>
			</section>
		)
	}

	const hasAttacks = attacksTotal > 0
	const riskHigher = avgRiskOnAttackDays != null && avgRiskOnPainFreeDays != null
		&& avgRiskOnAttackDays > avgRiskOnPainFreeDays
	const pressureLower = avgPressureOnAttack != null && avgPressureOnPainFree != null
		&& avgPressureOnAttack < avgPressureOnPainFree

	return (
		<section className={s.card}>
			<h3 className={s.title}>Погода и приступы</h3>

			<div className={s.grid}>
				<Metric
					label="Приступов в дни с повышенным риском"
					value={hasAttacks ? `${attacksOnElevatedRisk} / ${attacksTotal}` : '—'}
					sub={hasAttacks ? formatShare(attacksOnElevatedRisk, attacksTotal) : null}
				/>
				<Metric
					label="Средний риск в дни приступа"
					value={avgRiskOnAttackDays != null ? `${avgRiskOnAttackDays}` : '—'}
					sub="из 100"
					accent={riskHigher ? 'warning' : null}
				/>
				<Metric
					label="Средний риск в дни без боли"
					value={avgRiskOnPainFreeDays != null ? `${avgRiskOnPainFreeDays}` : '—'}
					sub="из 100"
				/>
				<Metric
					label="Среднее давление в дни приступа"
					value={avgPressureOnAttack != null ? `${avgPressureOnAttack} hPa` : '—'}
					accent={pressureLower ? 'warning' : null}
				/>
				<Metric
					label="Среднее давление в дни без боли"
					value={avgPressureOnPainFree != null ? `${avgPressureOnPainFree} hPa` : '—'}
				/>
			</div>

			{hasAttacks && (riskHigher || pressureLower) && (
				<p className={s.insight}>
					{riskHigher && 'В дни ваших приступов погодный риск в среднем выше. '}
					{pressureLower && 'Давление в дни приступов ниже среднего. '}
					Метео-чувствительность вероятна — стоит обратить внимание на прогноз.
				</p>
			)}

			<p className={s.footer}>
				Данных за {daysCovered} {pluralDays(daysCovered)} в периоде.
			</p>
		</section>
	)
}

const Metric = ({ label, value, sub, accent }) => (
	<div className={`${s.metric} ${accent === 'warning' ? s.metricWarn : ''}`}>
		<span className={s.metricLabel}>{label}</span>
		<span className={s.metricValue}>{value}</span>
		{sub && <span className={s.metricSub}>{sub}</span>}
	</div>
)

const pluralDays = n => {
	const mod10 = n % 10, mod100 = n % 100
	if (mod10 === 1 && mod100 !== 11) return 'день'
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня'
	return 'дней'
}

export default WeatherCorrelationBlock
