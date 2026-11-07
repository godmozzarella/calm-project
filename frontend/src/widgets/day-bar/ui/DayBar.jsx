import { useCallback, useEffect, useRef, useState } from 'react'
import { BackIcon, CalmSparkIcon, ChevronLeftIcon, ChevronRightIcon, LocationOnIcon } from '@/shared/ui/icons'
import { questionnaireApi } from '@/shared/api/questionnaireApi'
import { emit, subscribe, SURVEY_COMPLETED, OPEN_DAILY_QUESTIONNAIRE } from '@/shared/lib/dataEvents'
import { midnight } from '../lib/date'

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

const dayWord = count => {
	const lastTwo = count % 100
	if (lastTwo >= 11 && lastTwo <= 14) return 'дней'
	const last = count % 10
	if (last === 1) return 'день'
	if (last >= 2 && last <= 4) return 'дня'
	return 'дней'
}

const getWeekDays = date => {
	const day = date.getDay() === 0 ? 6 : date.getDay() - 1
	return Array.from({ length: 7 }, (_, i) => {
		const d = new Date(date)
		d.setDate(date.getDate() - day + i)
		return d
	})
}

const isSameDay = (a, b) =>
	a.getDate() === b.getDate() &&
	a.getMonth() === b.getMonth() &&
	a.getFullYear() === b.getFullYear()

const DayBar = ({ date, setDate, city, userId }) => {
	const [currentStreak, setCurrentStreak] = useState(0)
	const [earnedToday, setEarnedToday] = useState(false)
	const [flashKey, setFlashKey] = useState(0)
	const streakRequest = useRef(0)
	const loadStreak = useCallback(event => {
		if(!userId) return
		const request = ++streakRequest.current
		const response = Number.isInteger(event?.detail?.currentStreak) ? Promise.resolve(event.detail) : questionnaireApi.status()
		response.then(data => {
			if (request !== streakRequest.current) return
			const count = data.currentStreak ?? 0
			setCurrentStreak(count)
			setEarnedToday(event?.detail?.completedToday === true || Boolean(data.today))
			if(event?.type === SURVEY_COMPLETED) setFlashKey(key=>key+1)
		}).catch(() => {})
	}, [userId])
	useEffect(() => { loadStreak() }, [loadStreak])
	useEffect(() => subscribe(SURVEY_COMPLETED, loadStreak), [loadStreak])
	const today = midnight()
	const isToday = date.getTime() === today.getTime()
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
			<button className={s.navBtn} onClick={() => shift(-1)} aria-label="Предыдущий день" data-help="Показать записи дневника за предыдущий день.">
				<ChevronLeftIcon />
			</button>

			<div className={s.dayNumber}>
				<span className={s.number}>{date.getDate()}</span>
				<span className={s.month}>{MONTHS_SHORT[date.getMonth()]}</span>
			</div>

			<div className={`${s.center} ${!city ? s.centerNoCity : ''}`}>
				<span className={s.weekday}>{WEEKDAYS_FULL[date.getDay()]}</span>
				{city && (
					<span className={s.city} title={city}>
						<LocationOnIcon style={{ fontSize: '0.95rem' }} />
						<span className={s.cityName}>{city}</span>
					</span>
				)}
				{!isToday && (
					<button className={s.returnBtn} onClick={() => setDate(today)} data-help="Вернуться к записям за сегодня.">
						<BackIcon style={{ fontSize: '1rem' }} /> к сегодня
					</button>
				)}
			</div>

			<div className={`${s.streak} ${earnedToday ? s.streakEarned : ''} ${flashKey ? s.streakFlashed : ''}`}>
				<button
					data-streak-target="true"
					data-streak-lit={earnedToday}
					className={s.streakButton}
					type="button"
					data-help={`Серия чекина: ${currentStreak} ${dayWord(currentStreak)} подряд. Открыть карточки.`}
					aria-label={`Серия чекина: ${currentStreak} ${dayWord(currentStreak)}. Открыть карточки`}
					onClick={() => emit(OPEN_DAILY_QUESTIONNAIRE)}
				>
					<CalmSparkIcon key={`streak-icon-${flashKey}`} className={s.streakIcon} aria-hidden="true" />
				<strong>{currentStreak}</strong>
				</button>
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
							data-help={`Показать записи дневника за ${d.getDate()} ${MONTHS[d.getMonth()]}.`}
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
				data-help="Показать записи дневника за следующий день."
			>
				<ChevronRightIcon />
			</button>
		</div>
	)
}

export default DayBar
