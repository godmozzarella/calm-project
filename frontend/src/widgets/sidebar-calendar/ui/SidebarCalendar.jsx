import { useState } from 'react'

import { CloseIcon, ChevronLeftIcon, ChevronRightIcon } from '@/shared/ui/icons'
import { emit, DATE_SELECTED } from '@/shared/lib/dataEvents'

import s from './SidebarCalendar.module.scss'

/* ── constants ── */
const MONTHS = [
	'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
	'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const MARK_TYPES = {
	headache:   { label: 'Приступ',    color: '#ef4444' },
	medication: { label: 'Лекарство',  color: '#5cade4' },
	aura:       { label: 'Аура',       color: '#a855f7' },
	note:       { label: 'Заметка',    color: '#eab308' },
}

/* ── helpers ── */
const midnight = (d = new Date()) => {
	const c = new Date(d)
	c.setHours(0, 0, 0, 0)
	return c
}

const dateKey = d =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const loadMarks = () => {
	try { return JSON.parse(localStorage.getItem('calm_marks') ?? '{}') }
	catch { return {} }
}

const saveMarks = m => localStorage.setItem('calm_marks', JSON.stringify(m))

const buildGrid = (year, month) => {
	const first = new Date(year, month, 1)
	const lastDate = new Date(year, month + 1, 0).getDate()
	const startDow = first.getDay() === 0 ? 6 : first.getDay() - 1 // Mon-based

	const days = []

	for (let i = startDow - 1; i >= 0; i--)
		days.push({ date: new Date(year, month, -i), current: false })

	for (let i = 1; i <= lastDate; i++)
		days.push({ date: new Date(year, month, i), current: true })

	const tail = 7 - (days.length % 7)
	if (tail < 7)
		for (let i = 1; i <= tail; i++)
			days.push({ date: new Date(year, month + 1, i), current: false })

	return days
}

/* ── component ── */
const SidebarCalendar = ({ openCalendar, setOpenCalendar }) => {
	const today = midnight()

	const [viewYear, setViewYear]     = useState(today.getFullYear())
	const [viewMonth, setViewMonth]   = useState(today.getMonth())
	const [selected, setSelected]     = useState(null) // dateKey string
	const [marks, setMarks]           = useState(loadMarks)

	const grid = buildGrid(viewYear, viewMonth)

	const prevMonth = () => {
		if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
		else setViewMonth(m => m - 1)
	}

	const nextMonth = () => {
		if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
		else setViewMonth(m => m + 1)
	}

	const selectDay = key => {
		setSelected(prev => prev === key ? null : key)
		emit(DATE_SELECTED, key)
		setOpenCalendar(false)
	}

	const toggleMark = (key, type) => {
		setMarks(prev => {
			const list = prev[key] ?? []
			const next = list.includes(type) ? list.filter(t => t !== type) : [...list, type]
			const updated = { ...prev, [key]: next }
			if (next.length === 0) delete updated[key]
			saveMarks(updated)
			return updated
		})
	}

	const goToday = () => {
		setViewYear(today.getFullYear())
		setViewMonth(today.getMonth())
		setSelected(null)
	}

	const isViewingCurrentMonth =
		viewYear === today.getFullYear() && viewMonth === today.getMonth()

	return (
		<>
			<aside className={`${s.sidebar} ${openCalendar ? s.active : ''}`}>

				{/* ── header ── */}
				<div className={s.header}>
					<span className={s.title}>Календарь</span>
					<button className={s.iconBtn} onClick={() => setOpenCalendar(false)} aria-label="Закрыть">
						<CloseIcon fontSize="small" />
					</button>
				</div>

				{/* ── month navigation ── */}
				<div className={s.monthNav}>
					<button className={s.navBtn} onClick={prevMonth} aria-label="Предыдущий месяц">
						<ChevronLeftIcon fontSize="small" />
					</button>
					<div className={s.monthInfo}>
						<span className={s.monthName}>{MONTHS[viewMonth]}</span>
						<span className={s.yearLabel}>{viewYear}</span>
					</div>
					<button className={s.navBtn} onClick={nextMonth} aria-label="Следующий месяц">
						<ChevronRightIcon fontSize="small" />
					</button>
				</div>

				{/* ── weekday labels ── */}
				<div className={s.weekRow}>
					{WEEKDAYS.map(d => <span key={d} className={s.weekLabel}>{d}</span>)}
				</div>

				{/* ── day grid ── */}
				<div className={s.grid}>
					{grid.map(({ date, current }) => {
						const key = dateKey(date)
						const dayMarks = marks[key] ?? []
						const isToday = key === dateKey(today)
						const isFuture = date.getTime() > today.getTime()
						const isSelected = selected === key

						return (
							<button
								key={key + current}
								className={[
									s.cell,
									!current       && s.cellOther,
									isToday        && s.cellToday,
									isSelected     && s.cellSelected,
									isFuture       && s.cellFuture,
								].filter(Boolean).join(' ')}
								onClick={() => current && selectDay(key)}
								disabled={!current}
								tabIndex={current ? 0 : -1}
							>
								<span className={s.cellNum}>{date.getDate()}</span>
								{dayMarks.length > 0 && (
									<span className={s.dotRow}>
										{dayMarks.slice(0, 3).map(t => (
											<span
												key={t}
												className={s.dot}
												style={{ background: MARK_TYPES[t]?.color }}
											/>
										))}
									</span>
								)}
							</button>
						)
					})}
				</div>

				{/* ── mark panel (appears on day select) ── */}
				{selected && (
					<div className={s.markPanel}>
						<span className={s.markPanelTitle}>
							{selected.split('-').reverse().slice(0, 2).join('.')}
						</span>
						<div className={s.markList}>
							{Object.entries(MARK_TYPES).map(([type, { label, color }]) => {
								const active = (marks[selected] ?? []).includes(type)
								return (
									<button
										key={type}
										className={`${s.markItem} ${active ? s.markItemActive : ''}`}
										onClick={() => toggleMark(selected, type)}
									>
										<span className={s.markDot} style={{ background: color }} />
										<span className={s.markLabel}>{label}</span>
										{active && <span className={s.markCheck}>✓</span>}
									</button>
								)
							})}
						</div>
					</div>
				)}

				<div className={s.spacer} />

				{/* ── legend + go-to-today ── */}
				<div className={s.footer}>
					{!isViewingCurrentMonth && (
						<button className={s.todayLink} onClick={goToday}>
							← К текущему месяцу
						</button>
					)}
					<div className={s.legend}>
						{Object.entries(MARK_TYPES).map(([type, { label, color }]) => (
							<div key={type} className={s.legendItem}>
								<span className={s.dot} style={{ background: color }} />
								<span>{label}</span>
							</div>
						))}
					</div>
				</div>

			</aside>

			{openCalendar && (
				<div className={s.overlay} onClick={() => setOpenCalendar(false)} />
			)}
		</>
	)
}

export default SidebarCalendar
