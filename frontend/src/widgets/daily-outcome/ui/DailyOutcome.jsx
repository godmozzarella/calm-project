import { useEffect, useState } from 'react'

import { riskApi } from '@/shared/api'
import s from './DailyOutcome.module.scss'

const todayKey = () => {
	const now = new Date()
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const DailyOutcome = ({ date }) => {
	const [outcome, setOutcome] = useState(null)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const incomplete = date >= todayKey()

	useEffect(() => {
		let active = true
		setOutcome(null)
		setError('')
		riskApi.getOutcome(date)
			.then(result => { if (active) setOutcome(result.status) })
			.catch(() => { if (active) setError('Не удалось загрузить отметку за этот день.') })
		return () => { active = false }
	}, [date])

	const confirmNoAttack = async () => {
		setBusy(true)
		setError('')
		try {
			const result = await riskApi.confirmNoAttack(date, Intl.DateTimeFormat().resolvedOptions().timeZone)
			setOutcome(result.status)
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
		} catch (e) {
			setError(e.message || 'Не удалось изменить отметку.')
		} finally {
			setBusy(false)
		}
	}

	return (
		<section className={s.card} aria-label="Исход дня для проверки прогноза">
			<div className={s.copy}>
				<strong>Начался ли новый приступ в этот день?</strong>
				<span>
					{outcome === 'ATTACK_STARTED' && 'Да — день отмечен по записи приступа.'}
					{outcome === 'NO_ATTACK_STARTED' && 'Нет — отсутствие приступа подтверждено.'}
					{outcome === 'UNKNOWN' && 'Если приступа не было, подтвердите это. Без отметки день останется неизвестным.'}
					{!outcome && !error && 'Загружаем отметку…'}
				</span>
				{error && <span className={s.error} role="alert">{error}</span>}
			</div>
			{!incomplete && outcome === 'UNKNOWN' && (
				<button type="button" onClick={confirmNoAttack} disabled={busy || !outcome}>
					{busy ? 'Сохраняем…' : 'Приступа не было'}
				</button>
			)}
			{!incomplete && outcome === 'NO_ATTACK_STARTED' && (
				<button type="button" className={s.secondary} onClick={clearOutcome} disabled={busy}>
					{busy ? 'Сохраняем…' : 'Снять отметку'}
				</button>
			)}
			{incomplete && <span className={s.future}>Исход дня можно подтвердить на следующий день</span>}
		</section>
	)
}

export default DailyOutcome
