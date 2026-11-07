import { useEffect, useState } from 'react'

import { riskApi } from '@/shared/api'
import { emit, subscribe, ATTACKS_CHANGED, OUTCOMES_CHANGED } from '@/shared/lib/dataEvents'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'
import { isCentralError } from '@/shared/lib/isCentralError'
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
				.catch(error => {
					if (active && current === request && !isCentralError(error)) setErrors(previous => ({ ...previous, [date]: 'Не удалось загрузить отметку.' }))
				})
		}
		reload().then(() => { if (active) onInitialReady?.('outcome') })
		const unsubscribe = subscribe(ATTACKS_CHANGED, reload)
		return () => { active = false; unsubscribe() }
	}, [date, onInitialReady])

	const toggle = async () => {
		if (busy || !outcome || outcome === 'ATTACK_STARTED') return
		setBusyDates(previous => ({ ...previous, [date]: true }))
		setErrors(previous => {
			if (!previous[date]) return previous
			const next = { ...previous }
			delete next[date]
			return next
		})
		try {
			const result = outcome === 'NO_ATTACK_STARTED'
				? await riskApi.clearOutcome(date)
				: await riskApi.confirmNoAttack(date, Intl.DateTimeFormat().resolvedOptions().timeZone)
			setOutcomes(previous => ({ ...previous, [date]: result.status }))
			emit(OUTCOMES_CHANGED)
		} catch (e) {
			if (!isCentralError(e)) setErrors(previous => ({ ...previous, [date]: e.message || 'Не удалось изменить отметку.' }))
			try {
				const latest = await riskApi.getOutcome(date)
				setOutcomes(previous => ({ ...previous, [date]: latest.status }))
			} catch { /* Keep the last known state. */ }
		} finally {
			setBusyDates(previous => ({ ...previous, [date]: false }))
		}
	}

	const checked = outcome === 'NO_ATTACK_STARTED'
	const blocked = outcome === 'ATTACK_STARTED'
	const copy = blocked ? 'За день начался новый приступ'
        : checked ? 'Отмечено: новых приступов не было' : 'Новых приступов не было'

	return (
		<section className={`${s.card} ${blocked ? s.blocked : ''}`} aria-label="Отсутствие новых начал приступа" aria-busy={outcome === null}>
			<div className={s.text}>
				{outcome === null
					? <span className={s.copyPlaceholder} aria-hidden="true" />
					: <span className={s.copy}>{copy}</span>}
				{isToday && !blocked && <span className={s.hint}>Если начнётся новый приступ, добавьте его: отметка отменится автоматически.</span>}
			</div>
			{outcome === null ? <span className={s.togglePlaceholder} aria-hidden="true" /> : <button
				type="button"
				role="switch"
				aria-label="Новых приступов не было"
				aria-checked={checked}
				data-help="Отметьте, если за выбранный день не началось новых приступов. Продолжение приступа с прошлого дня не мешает поставить отметку. Итог закрывается в полночь; запись можно исправить позже."
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
