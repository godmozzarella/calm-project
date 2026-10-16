import { useCallback, useEffect, useRef, useState } from 'react'
import SpaOutlinedIcon from '@mui/icons-material/SpaOutlined'
import { BackIcon, ChevronLeftIcon, ChevronRightIcon, LocationOnIcon } from '@/shared/ui/icons'
import { statsApi } from '@/shared/api'
import { subscribe, ATTACKS_CHANGED, OUTCOMES_CHANGED } from '@/shared/lib/dataEvents'
import { midnight } from '../lib/date'
import { streakIncrease, streakSnapshotKey } from '../lib/streakAnimation'

import s from './DayBar.module.scss'

const WEEKDAYS_FULL = [
	'Воскресенье', 'Понедельник', 'Вторник', 'Среда',
	'Четверг', 'Пятница', 'Суббота',
]

const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

const MONTHS = [
	'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
	'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

const MONTHS_SHORT = [
	'янв', 'фев', 'мар', 'апр', 'май', 'июн',
	'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]

const diffDays = (a, b) =>
	Math.round((b.getTime() - a.getTime()) / 86_400_000)

const getWeekDays = date => {
	const day = date.getDay() === 0 ? 6 : date.getDay() - 1
	return Array.from({ length: 7 }, (_, i) => {
		const d = new Date(date)
		d.setDate(date.getDate() - day + i)
		return d
	})
}

const relativeLabel = date => {
	const today = midnight()
	const diff = diffDays(date, today)
	if (diff === 0) return 'Сегодня'
	if (diff === 1) return 'Вчера'
	if (diff === 2) return 'Позавчера'
	if (diff > 2) return `${diff} дня назад`
	return null
}

const isSameDay = (a, b) =>
	a.getDate() === b.getDate() &&
	a.getMonth() === b.getMonth() &&
	a.getFullYear() === b.getFullYear()

const DayBar = ({ date, setDate, city, userId }) => {
	const [currentStreak, setCurrentStreak] = useState(0)
	const [streakGain, setStreakGain] = useState(0)
	const [streakInfoOpen, setStreakInfoOpen] = useState(false)
	const animationTimer = useRef(null)
	const streakRequest = useRef(0)
	const streakPreviewApplied = useRef(false)
	const loadStreak = useCallback(() => {
		const request = ++streakRequest.current
		statsApi.getSummary('month').then(data => {
			if (request !== streakRequest.current) return
			const count = data.kpis?.currentStreak ?? 0
			let previewIncrease = false
			if (!streakPreviewApplied.current) {
				try {
					previewIncrease = sessionStorage.getItem('calm_streak_preview') === '1'
					if (previewIncrease) sessionStorage.removeItem('calm_streak_preview')
				} catch { /* Preview is optional when browser storage is unavailable. */ }
				streakPreviewApplied.current = true
			}
			setCurrentStreak(count + (previewIncrease ? 1 : 0))
			if (!userId) return
			const key = streakSnapshotKey(userId)
			let previous = null
			try {
				previous = JSON.parse(localStorage.getItem(key) || 'null')
			} catch { /* Ignore an unavailable or invalid previous snapshot. */ }
			try { localStorage.setItem(key, JSON.stringify({ count })) } catch { /* Storage may be disabled. */ }
			const increase = previewIncrease ? 1 : streakIncrease(previous, count)
			window.clearTimeout(animationTimer.current)
			setStreakGain(increase)
			if (increase > 0) animationTimer.current = window.setTimeout(() => setStreakGain(0), 1600)
		}).catch(() => {})
	}, [userId])
	useEffect(() => { loadStreak() }, [loadStreak])
	useEffect(() => subscribe(ATTACKS_CHANGED, loadStreak), [loadStreak])
	useEffect(() => subscribe(OUTCOMES_CHANGED, loadStreak), [loadStreak])
	useEffect(() => () => window.clearTimeout(animationTimer.current), [])
	useEffect(() => {
		if (!streakInfoOpen) return undefined
		const closeOnEscape = event => {
			if (event.key === 'Escape') setStreakInfoOpen(false)
		}
		window.addEventListener('keydown', closeOnEscape)
		return () => window.removeEventListener('keydown', closeOnEscape)
	}, [streakInfoOpen])
	const today = midnight()
	const isToday = date.getTime() === today.getTime()
	const label = relativeLabel(date)
	const weekDays = getWeekDays(date)

	const shift = days => {
		setDate(prev => {
			const next = new Date(prev)
			next.setDate(next.getDate() + days)
			return next
		})
	}

	return (
		<div className={s.dayBar}>
			<button className={s.navBtn} onClick={() => shift(-1)} aria-label="Предыдущий день">
				<ChevronLeftIcon />
			</button>

			<div className={s.dayNumber}>
				<span className={s.number}>{date.getDate()}</span>
				<span className={s.month}>{MONTHS_SHORT[date.getMonth()]}</span>
			</div>

			<div className={s.center}>
				<span className={s.weekday}>{WEEKDAYS_FULL[date.getDay()]}</span>
				{label && (
					<span className={`${s.label} ${isToday ? s.labelToday : s.labelPast}`}>
						{label}
					</span>
				)}
				{city && (
					<span className={s.city} title={city}>
						<LocationOnIcon style={{ fontSize: '0.95rem' }} />
						{city}
					</span>
				)}
				{!isToday && (
					<button className={s.returnBtn} onClick={() => setDate(today)}>
						<BackIcon style={{ fontSize: '1rem' }} /> к сегодня
					</button>
				)}
			</div>

			<div className={`${s.streak} ${streakGain ? s.streakIncreased : ''}`}>
				<button
					className={s.streakButton}
					type="button"
					title={`Серия без приступов: ${currentStreak} дн. подряд`}
					aria-label={`Серия без приступов: ${currentStreak} дней. Открыть памятку`}
					aria-expanded={streakInfoOpen}
					aria-controls="streak-info"
					onClick={() => setStreakInfoOpen(open => !open)}
				>
				<SpaOutlinedIcon fontSize="small" aria-hidden="true" />
				<strong key={currentStreak}>{currentStreak}</strong>
				{streakGain > 0 && <span className={s.streakGain} aria-hidden="true">+{streakGain}</span>}
				</button>
				{streakInfoOpen && (
					<div className={s.streakInfo} id="streak-info" role="dialog" aria-label="Как работает серия без приступов">
						<strong>Стрик без боли</strong>
						<p>Это число подряд идущих дней, которые вы отметили как дни без приступов.</p>
						<p>Подтвердите отсутствие приступа за день, чтобы серия продолжилась. День с приступом сбрасывает текущую серию. Неподтверждённые дни в неё не засчитываются.</p>
						<button className={s.streakInfoClose} type="button" onClick={() => setStreakInfoOpen(false)}>Понятно</button>
					</div>
				)}
			</div>

			<div className={s.weekStrip}>
				{weekDays.map(d => {
					const selected = isSameDay(d, date)
					const todayDay = isSameDay(d, today)
					const future = d.getTime() > today.getTime()
					return (
						<button
							key={d.toISOString()}
							className={[
								s.dayPill,
								selected                   && s.dayPillSelected,
								todayDay && !selected      && s.dayPillToday,
								future                     && s.dayPillFuture,
							].filter(Boolean).join(' ')}
							onClick={() => !future && setDate(midnight(d))}
							disabled={future}
							aria-label={`${d.getDate()} ${MONTHS[d.getMonth()]}`}
						>
							<span className={s.pillName}>{WEEKDAYS_SHORT[d.getDay()]}</span>
							<span className={s.pillNum}>{d.getDate()}</span>
						</button>
					)
				})}
			</div>

			<button
				className={`${s.navBtn} ${isToday ? s.navBtnDisabled : ''}`}
				onClick={() => !isToday && shift(1)}
				disabled={isToday}
				aria-label="Следующий день"
			>
				<ChevronRightIcon />
			</button>
		</div>
	)
}

export default DayBar
