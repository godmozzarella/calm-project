import { useEffect, useState } from 'react'

import { riskApi } from '@/shared/api'
import { emit, subscribe, ATTACKS_CHANGED, OUTCOMES_CHANGED } from '@/shared/lib/dataEvents'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'
import s from './DailyOutcome.module.scss'

const yesterdayKey = () => {
	const day = new Date()
	day.setDate(day.getDate() - 1)
	return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

const DailyOutcome = () => {
	const date = yesterdayKey()
	const [outcome, setOutcome] = useState(null)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		setOutcome(null)
		setError('')
		const reload = () => riskApi.getOutcome(date)
			.then(result => { if (active) setOutcome(result.status) })
			.catch(() => { if (active) setError('Не удалось загрузить отметку за этот день.') })
		reload()
		const unsubscribe = subscribe(ATTACKS_CHANGED, reload)
		return () => { active = false; unsubscribe() }
	}, [date])

	const confirmNoAttack = async () => {
		setBusy(true)
		setError('')
		try {
			const result = await riskApi.confirmNoAttack(date, Intl.DateTimeFormat().resolvedOptions().timeZone)
			setOutcome(result.status)
			emit(OUTCOMES_CHANGED)
		} catch (e) {
			setError(e.message || 'Не удалось сохранить отметку.')
		} finally {
			setBusy(false)
		}
	}

	const clearOutcome = async () => {
		setBusy(true)
		setError('')
		try {
			const result = await riskApi.clearOutcome(date)
			setOutcome(result.status)
			emit(OUTCOMES_CHANGED)
		} catch (e) {
			setError(e.message || 'Не удалось изменить отметку.')
		} finally {
			setBusy(false)
		}
	}

	return (
		<section className={s.card} aria-label="Итог вчерашнего дня">
			<div className={s.copy}>
				<strong>Вчера, {date.split('-').reverse().slice(0, 2).join('.')}: был приступ?</strong>
				<span>
					{outcome === 'ATTACK_PRESENT' && 'Да — день отмечен по записи приступа.'}
					{outcome === 'NO_ATTACK' && 'Нет — отсутствие приступа подтверждено.'}
					{outcome === 'UNKNOWN' && 'Если приступа не было, подтвердите это. Без отметки день останется неизвестным.'}
					{!outcome && !error && 'Загружаем отметку…'}
				</span>
				<ErrorNotice message={error} title="Не удалось обновить итог дня" />
			</div>
			{outcome === 'UNKNOWN' && (
				<button type="button" onClick={confirmNoAttack} disabled={busy || !outcome}>
					{busy ? 'Сохраняем…' : 'Приступа не было'}
				</button>
			)}
			{outcome === 'NO_ATTACK' && (
				<button type="button" className={s.secondary} onClick={clearOutcome} disabled={busy}>
					{busy ? 'Сохраняем…' : 'Снять отметку'}
				</button>
			)}
		</section>
	)
}

export default DailyOutcome
