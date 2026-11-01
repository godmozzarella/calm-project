import { useEffect, useState } from 'react'

import { riskApi } from '@/shared/api'
import { emit, subscribe, ATTACKS_CHANGED, OUTCOMES_CHANGED } from '@/shared/lib/dataEvents'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'
import s from './DailyOutcome.module.scss'

const DailyOutcome = ({ date, isToday, onInitialReady }) => {
	const [outcomes, setOutcomes] = useState({})
	const [busyDates, setBusyDates] = useState({})
	const [errors, setErrors] = useState({})
	const outcome = outcomes[date] ?? null
	const busy = !!busyDates[date]
	const error = errors[date] || ''

	useEffect(() => {
		let active = true
		let request = 0
		const reload = () => {
			const current = ++request
			setErrors(previous => {
				if (!previous[date]) return previous
				const next = { ...previous }
				delete next[date]
				return next
			})
			return riskApi.getOutcome(date)
				.then(result => {
					if (active && current === request) setOutcomes(previous => ({ ...previous, [date]: result.status }))
				})
				.catch(() => {
					if (active && current === request) setErrors(previous => ({ ...previous, [date]: 'Не удалось загрузить отметку.' }))
				})
		}
		reload().then(() => { if (active) onInitialReady?.('outcome') })
		const unsubscribe = subscribe(ATTACKS_CHANGED, reload)
		return () => { active = false; unsubscribe() }
	}, [date, onInitialReady])

	const toggle = async () => {
		if (busy || !outcome || outcome === 'ATTACK_PRESENT') return
		setBusyDates(previous => ({ ...previous, [date]: true }))
		setErrors(previous => {
			if (!previous[date]) return previous
			const next = { ...previous }
			delete next[date]
			return next
		})
		try {
			const result = outcome === 'NO_ATTACK'
				? await riskApi.clearOutcome(date)
				: await riskApi.confirmNoAttack(date, Intl.DateTimeFormat().resolvedOptions().timeZone)
			setOutcomes(previous => ({ ...previous, [date]: result.status }))
			emit(OUTCOMES_CHANGED)
		} catch (e) {
			setErrors(previous => ({ ...previous, [date]: e.message || 'Не удалось изменить отметку.' }))
			try {
				const latest = await riskApi.getOutcome(date)
				setOutcomes(previous => ({ ...previous, [date]: latest.status }))
			} catch { /* Keep the last known state. */ }
		} finally {
			setBusyDates(previous => ({ ...previous, [date]: false }))
		}
	}

	const checked = outcome === 'NO_ATTACK'
	const blocked = outcome === 'ATTACK_PRESENT'
	const copy = blocked ? 'За день есть приступ'
		: isToday ? checked ? 'Отмечено: пока без приступа' : 'Отметить: пока без приступа'
			: checked ? 'Отмечено: приступа не было' : 'Отметить день без приступа'

	return (
		<section className={`${s.card} ${blocked ? s.blocked : ''}`} aria-label="Отметка о приступе за день" aria-busy={outcome === null}>
			<div className={s.text}>
				{outcome === null
					? <span className={s.copyPlaceholder} aria-hidden="true" />
					: <span className={s.copy}>{copy}</span>}
				{isToday && !blocked && <span className={s.hint}>Если приступ начнётся позже, добавьте его в дневник.</span>}
			</div>
			{outcome === null ? <span className={s.togglePlaceholder} aria-hidden="true" /> : <button
				type="button"
				role="switch"
				aria-label={isToday ? 'Пока без приступа' : 'День без приступа'}
				aria-checked={checked}
				data-help={isToday
					? 'Отметьте, что пока сегодня приступа не было. Если приступ начнётся позже, добавьте его в дневник: отметка изменится. Для обучения итог дня учитывается после его завершения.'
					: 'Отметьте день без приступа, если за весь выбранный день приступа не было. Это помогает вести дневник и собирать точные данные для модели.'}
				className={`${s.toggle} ${checked ? s.toggleOn : ''}`}
				onClick={toggle}
				disabled={busy || blocked}
			>
				<span className={s.thumb} aria-hidden="true" />
			</button>}
			{error && <ErrorNotice message={error} title="Не удалось обновить отметку" className={s.error} />}
		</section>
	)
}

export default DailyOutcome
