import { useEffect, useState } from 'react'

import { forecastApi, medicationApi, riskApi } from '@/shared/api'
import { emit, OPEN_ATTACK_FORM, subscribe, ATTACKS_CHANGED, MEDICATIONS_CHANGED } from '@/shared/lib/dataEvents'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'
import { formatPressure } from '@/shared/lib/pressure'
import { advice, conclusion, dayLabel, helpfulMedication, LEVEL_LABELS, longDate, riskFactors, shortDate, weatherTiles } from './forecastViewModel'
import s from './ForecastSection.module.scss'

const ForecastSection = ({ user, onOpenLocationModal }) => {
	const [data, setData] = useState(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const [selectedDay, setSelectedDay] = useState(0)
	const [risks, setRisks] = useState({})
	const [riskErrors, setRiskErrors] = useState({})
	const [medications, setMedications] = useState([])
	const hasLocation = user?.latitude != null && user?.longitude != null

	useEffect(() => {
		if (!hasLocation) return
		let cancelled = false
		setLoading(true)
		setError(null)
		setData(null)
		setRisks({})
		setRiskErrors({})
		setSelectedDay(0)
		forecastApi.getForecast({ lat: user.latitude, lon: user.longitude })
			.then(result => { if (!cancelled) setData(result) })
			.catch(e => { if (!cancelled) setError(e.message || 'Не удалось получить прогноз') })
			.finally(() => { if (!cancelled) setLoading(false) })
		return () => { cancelled = true }
	}, [hasLocation, user?.latitude, user?.longitude])

	useEffect(() => {
		if (!hasLocation || !data?.days?.length) return
		let cancelled = false
		// Запросы будущих дат также сохраняют предварительные оценки для проверки качества.
		data.days.slice(0, 7).forEach(day => {
			riskApi.getByDate(day.date)
				.then(result => { if (!cancelled) setRisks(previous => ({ ...previous, [day.date]: result })) })
				.catch(e => { if (!cancelled) setRiskErrors(previous => ({ ...previous, [day.date]: e.message || 'Не удалось рассчитать риск' })) })
		})
		return () => { cancelled = true }
	}, [hasLocation, data])

	useEffect(() => {
		if (!hasLocation) return
		let cancelled = false
		const reload = () => medicationApi.getAll()
			.then(result => { if (!cancelled) setMedications(result) })
			.catch(() => { if (!cancelled) setMedications([]) })
		reload()
		const off = subscribe(MEDICATIONS_CHANGED, reload)
		return () => { cancelled = true; off() }
	}, [hasLocation])

	useEffect(() => {
		if (!hasLocation || !data?.days?.length) return
		let cancelled = false
		const reload = () => {
			data.days.slice(0, 7).forEach(day => {
				riskApi.getByDate(day.date).then(result => {
					if (!cancelled) setRisks(previous => ({ ...previous, [day.date]: result }))
				}).catch(() => {})
			})
		}
		const offAttacks = subscribe(ATTACKS_CHANGED, reload)
		const offMeds = subscribe(MEDICATIONS_CHANGED, reload)
		return () => { cancelled = true; offAttacks(); offMeds() }
	}, [hasLocation, data])

	const days = data?.days?.slice(0, 7) || []
	const active = days[selectedDay] || days[0]
	const risk = active ? risks[active.date] : null
	const factors = riskFactors(risk)
	const lowData = risk?.dataAvailable && risk.historyLevel === 'LOW'
	const tiles = active ? weatherTiles(risk?.dataAvailable ? risk.inputs : active) : []
	const score = risk?.dataAvailable ? risk.score : null
	const level = risk?.dataAvailable ? risk.level : null

	return (
		<section className={s.section} aria-labelledby="forecast-title">
			<div className={s.header}>
				<div>
					<h1 id="forecast-title">Прогноз головной боли</h1>
					<p>Выберите день, чтобы увидеть, что на него влияет.</p>
				</div>
				{risk?.dataAvailable && <span className={s.confidence}>
					{lowData ? 'Точность пока низкая — мало записей' : `Прогноз основан на ${risk.inputs.historyDays} ${risk.inputs.historyDays === 1 ? 'дне' : 'днях'} наблюдений`}
				</span>}
			</div>

			{!hasLocation && <div className={s.card}><p>Укажите город, чтобы видеть прогноз.</p>{onOpenLocationModal && <button type="button" className={s.action} onClick={onOpenLocationModal}>Указать город</button>}</div>}
			{hasLocation && loading && !data && <div className={s.card} role="status">Загружаем прогноз…</div>}
			{hasLocation && <ErrorNotice message={error} title="Не удалось загрузить прогноз" />}
			{hasLocation && !loading && !error && !days.length && <div className={s.card} role="status">Прогноз временно недоступен. Попробуйте обновить позже.</div>}

			{active && <>
				{data.stale && <p className={s.stale}>Сервис погоды временно недоступен. Показаны последние сохранённые данные{data.cachedAt ? ` от ${new Date(data.cachedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}.</p>}
				<div className={s.days} style={{ '--day-count': days.length }} aria-label="Выбор дня прогноза">
					{days.map((day, index) => {
						const dayRisk = risks[day.date]
						const dayLevel = dayRisk?.dataAvailable ? dayRisk.level : null
						return <button key={day.date} type="button" className={`${s.day} ${dayLevel ? s[`level_${dayLevel}`] : ''} ${index === selectedDay ? s.selected : ''}`} aria-pressed={index === selectedDay} onClick={() => setSelectedDay(index)}>
							<span className={s.dayName}>{dayLabel(day.date, index === 0)}</span>
							<span className={s.dayDate}>{shortDate(day.date)}</span>
							<span className={s.dayScore}>{dayRisk?.dataAvailable ? dayRisk.score : riskErrors[day.date] ? '—' : '…'}<small>{dayRisk?.dataAvailable ? '/100' : ''}</small></span>
							<span className={s.dayLevel}>{dayLevel ? LEVEL_LABELS[dayLevel] : dayRisk?.dataAvailable === false ? 'Нет оценки' : 'Ожидаем'}</span>
							<span className={s.dayPressure}>{day.pressureMmHg == null ? 'Давление —' : formatPressure(day.pressureMmHg)}</span>
						</button>
					})}
				</div>

				<div className={s.summaryGrid}>
					<article className={`${s.card} ${level ? s[`level_${level}`] : ''}`} aria-live="polite">
						<h2 className={s.sectionLabel}>Итог дня</h2>
						<p className={s.dateEyebrow}>{longDate(active.date, selectedDay === 0)}</p>
						{score == null ? riskErrors[active.date]
							? <ErrorNotice message={riskErrors[active.date]} title="Не удалось рассчитать оценку" />
							: <p className={s.pending}>{risk?.message || 'Рассчитываем оценку…'}</p> : <>
							<div className={s.scoreLine}><strong>{score}</strong><span>из 100</span><b>{LEVEL_LABELS[level]} риск</b></div>
							<div className={s.scale} role="img" aria-label={`Оценка ${score} из 100, ${LEVEL_LABELS[level].toLowerCase()} риск`}>
								<div className={s.scaleTrack}><span className={s.scaleFill} style={{ width: `${score}%` }}/><i style={{ left: `clamp(.2rem, ${score}%, calc(100% - .2rem))` }}/></div>
								<div className={s.scaleLabels}><span>Низкий</span><span>Повышенный</span><span>Высокий</span></div>
							</div>
							<p className={s.conclusion}>{conclusion(risk, factors, selectedDay === 0)}</p>
							<p className={s.ruleNote}>Оценка по правилам, не вероятность приступа.</p>
						</>}
					</article>

					<article className={s.card} aria-live="polite">
						<h2 className={s.sectionLabel}>Что влияет на прогноз</h2>
						{lowData && <div className={s.lowData}><p>Добавьте записи о приступах — прогноз станет точнее.</p><button type="button" className={s.action} onClick={() => emit(OPEN_ATTACK_FORM)}>Добавить приступ</button></div>}
						{score == null && <p className={s.pending}>Факторы появятся вместе с оценкой.</p>}
						{score != null && !factors.length && <p className={s.pending}>Заметных факторов для этого дня нет.</p>}
						{factors.map(factor => <div key={factor.key} className={`${s.factor} ${factor.points >= 25 ? s.factorStrong : factor.points >= 15 ? s.factorMedium : factor.points >= 8 ? s.factorNoticeable : s.factorWeak}`}>
							<div className={s.factorHead}><strong>{factor.title}</strong><b>{factor.intensity}</b></div>
							<div className={s.factorTrack}><span style={{ width: `${Math.min(100, factor.points)}%` }}/></div>
							<p>{factor.detail}</p>
						</div>)}
					</article>
				</div>

				<section className={s.card} aria-labelledby="forecast-weather">
					<h2 className={s.sectionLabel} id="forecast-weather">Погода {selectedDay === 0 ? 'сегодня' : shortDate(active.date)}</h2>
					<div className={s.weatherGrid}>{tiles.map(tile => <div className={s.weatherTile} key={tile.key}>
						<span className={s.weatherLabel}><i className={tile.alert ? s.alertDot : s.normalDot}/>{tile.label}</span>
						<strong>{tile.value}</strong>
						<small>{tile.status}</small>
					</div>)}</div>
				</section>

				{score != null && <section className={s.card} aria-labelledby="forecast-advice">
					<h2 className={s.sectionLabel} id="forecast-advice">Что сделать {selectedDay === 0 ? 'сегодня' : 'в этот день'}</h2>
					<ol className={s.advice}>{advice(risk, helpfulMedication(medications)).map(item => <li key={item}>{item}</li>)}</ol>
				</section>}
			</>}
		</section>
	)
}

export default ForecastSection
