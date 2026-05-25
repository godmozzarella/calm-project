import { useEffect, useState } from 'react'

import { forecastApi } from '@/shared/api'
import { SpeedIcon, ThermostatIcon, WaterDropIcon, AirIcon } from '@/shared/ui/icons'

import s from './ForecastSection.module.scss'

const RISK_LABELS = {
	LOW: 'Низкий риск',
	MEDIUM: 'Повышенный',
	HIGH: 'Высокий риск',
}

const RU_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const RU_WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

const formatDay = (isoDate, isToday) => {
	const d = new Date(isoDate + 'T00:00:00')
	if (isToday) return 'Сегодня'
	return `${RU_WEEKDAYS[d.getDay()]} · ${d.getDate()} ${RU_MONTHS[d.getMonth()]}`
}

const ForecastSection = ({ user }) => {
	const [data, setData] = useState(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const [expanded, setExpanded] = useState(0)

	const hasLocation = user?.latitude != null && user?.longitude != null

	useEffect(() => {
		if (!hasLocation) return
		setLoading(true)
		setError(null)
		forecastApi.getForecast({ lat: user.latitude, lon: user.longitude })
			.then(setData)
			.catch(e => setError(e.message || 'Не удалось получить прогноз'))
			.finally(() => setLoading(false))
	}, [hasLocation, user?.latitude, user?.longitude])

	if (!hasLocation) {
		return (
			<section className={s.card}>
				<p className={s.empty}>
					Укажи свой город в профиле, чтобы видеть прогноз погодного риска.
				</p>
			</section>
		)
	}

	if (loading && !data) {
		return (
			<section className={s.card}>
				<p className={s.empty}>Загружаем прогноз...</p>
			</section>
		)
	}

	if (error) {
		return (
			<section className={s.card}>
				<p className={s.errorText}>{error}</p>
			</section>
		)
	}

	if (!data || !data.days?.length) return null

	const days = data.days.slice(0, 4)
	const active = days[expanded] ?? days[0]

	return (
		<section className={s.card}>
			<div className={s.tiles}>
				{days.map((d, i) => (
					<button
						key={d.date}
						type="button"
						className={`${s.tile} ${s[`risk_${d.risk}`]} ${i === expanded ? s.tileActive : ''}`}
						onClick={() => setExpanded(i)}
					>
						<span className={s.tileDay}>{formatDay(d.date, i === 0)}</span>
						<span className={s.tileRisk}>{RISK_LABELS[d.risk]}</span>
						{d.pressureHpa != null && (
							<span className={s.tilePressure}>{Math.round(d.pressureHpa)} hPa</span>
						)}
					</button>
				))}
			</div>

			<div className={`${s.detail} ${s[`detail_${active.risk}`]}`}>
				<div className={s.detailHead}>
					<span className={s.detailDay}>{formatDay(active.date, days.indexOf(active) === 0)}</span>
					<span className={s.detailRisk}>{RISK_LABELS[active.risk]}</span>
				</div>

				{active.reasons?.length > 0 ? (
					<ul className={s.reasons}>
						{active.reasons.map((r, i) => <li key={i}>{r}</li>)}
					</ul>
				) : (
					<p className={s.reasonsOk}>Спокойная погода. Резких перепадов не ожидается.</p>
				)}

				<dl className={s.metrics}>
					{active.pressureHpa != null && (
						<Metric icon={<SpeedIcon />} label="Давление" value={`${Math.round(active.pressureHpa)} hPa`}
							sub={active.pressureDelta24h != null
								? `${active.pressureDelta24h > 0 ? '+' : ''}${active.pressureDelta24h.toFixed(1)} за сутки`
								: null}
							tip="Атмосферное давление. Резкое падение на 5+ гПа за сутки повышает риск приступа." />
					)}
					{active.humidity != null && (
						<Metric icon={<WaterDropIcon />} label="Влажность" value={`${Math.round(active.humidity)}%`}
							tip="Относительная влажность воздуха. Выше 85% — дополнительный фактор риска." />
					)}
					{(active.tempMin != null && active.tempMax != null) && (
						<Metric icon={<ThermostatIcon />} label="Температура"
							value={`${Math.round(active.tempMin)}…${Math.round(active.tempMax)}°C`}
							tip="Диапазон температур за день. Перепад более 10°C может спровоцировать приступ." />
					)}
					{active.windKmhMax != null && (
						<Metric icon={<AirIcon />} label="Ветер до" value={`${Math.round(active.windKmhMax)} км/ч`}
							tip="Максимальные порывы ветра за день (км/ч)." />
					)}
					{active.kpIndex != null && (
						<Metric
							icon={<span className={s.kpIcon}>☀</span>}
							label="Kp-индекс"
							value={active.kpIndex.toFixed(1)}
							sub={active.kpIndex >= 5 ? 'буря' : active.kpIndex >= 4 ? 'умеренный' : 'спокойно'}
							tip="Индекс геомагнитной активности (0–9). Значения ≥5 могут влиять на самочувствие. Данные: NOAA SWPC."
						/>
					)}
				</dl>
			</div>
		</section>
	)
}

const Metric = ({ icon, label, value, sub, tip }) => (
	<div className={s.metric} data-tip={tip}>
		<span className={s.metricIcon}>{icon}</span>
		<div className={s.metricBody}>
			<span className={s.metricLabel}>{label}</span>
			<span className={s.metricValue}>{value}</span>
			{sub && <span className={s.metricSub}>{sub}</span>}
		</div>
	</div>
)

export default ForecastSection
