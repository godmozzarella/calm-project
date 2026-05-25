import { ChevronLeftIcon, ChevronRightIcon, LocationOnIcon } from '@/shared/ui/icons'

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

export const midnight = (d = new Date()) => {
	const copy = new Date(d)
	copy.setHours(0, 0, 0, 0)
	return copy
}

export const dateKey = d =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

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

const DayBar = ({ date, setDate, city }) => {
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
						← к сегодня
					</button>
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
