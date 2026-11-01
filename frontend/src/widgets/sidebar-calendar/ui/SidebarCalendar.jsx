import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { BackIcon, CloseIcon, ArrowForwardIcon } from '@/shared/ui/icons'
import { attackApi, medicationApi } from '@/shared/api'
import { subscribe, emit, ATTACKS_CHANGED, MEDICATIONS_CHANGED, DATE_SELECTED } from '@/shared/lib/dataEvents'
import s from './SidebarCalendar.module.scss'

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS_BACK_INITIAL = 1
const MONTHS_BACK_MAX = 60
const MONTHS_FORWARD = 12
const MARK_TYPES = {
	headache: { label: 'Приступ', color: '#ef4444' },
	medication: { label: 'Лекарство', color: 'var(--fc-contrast)' },
	note: { label: 'Заметка', color: '#eab308' },
}

const midnight = (d = new Date()) => {
	const copy = new Date(d)
	copy.setHours(0, 0, 0, 0)
	return copy
}
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monthIndex = date => date.getFullYear() * 12 + date.getMonth()
const monthFromIndex = index => new Date(Math.floor(index / 12), index % 12, 1)
const monthKey = date => dateKey(date).slice(0, 7)

const buildGrid = (year, month) => {
	const first = new Date(year, month, 1)
	const lastDate = new Date(year, month + 1, 0).getDate()
	const startDow = first.getDay() === 0 ? 6 : first.getDay() - 1
	const days = []
	for (let i = startDow - 1; i >= 0; i--) days.push({ date: null, current: false })
	for (let i = 1; i <= lastDate; i++) days.push({ date: new Date(year, month, i), current: true })
	const tail = 7 - (days.length % 7)
	if (tail < 7) for (let i = 1; i <= tail; i++) days.push({ date: null, current: false })
	return days
}

const marksFromEntries = (attacks, medications) => {
	const marks = {}
	const add = (day, type) => {
		if (!day) return
		const dayMarks = marks[day] ?? new Set()
		dayMarks.add(type)
		marks[day] = dayMarks
	}
	for (const attack of attacks) {
		add(attack.startDate ?? attack.date, 'headache')
		if (attack.note?.trim()) add(attack.startDate ?? attack.date, 'note')
	}
	for (const medication of medications) {
		add(medication.date, 'medication')
		if (medication.note?.trim()) add(medication.date, 'note')
	}
	return marks
}

const SidebarCalendar = ({ openCalendar, setOpenCalendar, currentDate }) => {
	const today = midnight()
	const todayKey = dateKey(today)
	const currentDateKey = dateKey(currentDate)
	const [selected, setSelected] = useState(null)
	const [marks, setMarks] = useState({})
	const [historyExpanded, setHistoryExpanded] = useState(false)
	const monthListRef = useRef(null)
	const months = useMemo(() => {
		const todayMonth = monthIndex(new Date(`${todayKey}T12:00:00`))
        const currentDiaryMonth = monthIndex(new Date(`${currentDateKey}T12:00:00`))
		const first = historyExpanded
			? todayMonth - MONTHS_BACK_MAX
			: Math.min(todayMonth - MONTHS_BACK_INITIAL, currentDiaryMonth)
		const last = todayMonth + MONTHS_FORWARD
		return Array.from({ length: last - first + 1 }, (_, offset) => {
			const date = monthFromIndex(first + offset)
			return { date, key: monthKey(date), grid: buildGrid(date.getFullYear(), date.getMonth()) }
		})
	}, [todayKey, currentDateKey, historyExpanded])

	const loadMarks = useCallback(() => {
		Promise.all([attackApi.getAll(), medicationApi.getAll()])
			.then(([attacks, medications]) => setMarks(marksFromEntries(attacks, medications)))
			.catch(() => {})
	}, [])
	useEffect(() => { if (openCalendar) loadMarks() }, [openCalendar, loadMarks])
	useEffect(() => {
		if (!openCalendar) {
			setHistoryExpanded(false)
			return
		}
		setSelected(null)
		setHistoryExpanded(false)
	}, [openCalendar, currentDateKey])
	useLayoutEffect(() => {
		if (!openCalendar) return
		const list = monthListRef.current
		const target = list?.querySelector(`[data-month-key="${currentDateKey.slice(0, 7)}"]`)
		if (list && target) list.scrollTop = target.offsetTop - list.offsetTop
	}, [openCalendar, currentDateKey])
	useEffect(() => subscribe(ATTACKS_CHANGED, loadMarks), [loadMarks])
	useEffect(() => subscribe(MEDICATIONS_CHANGED, loadMarks), [loadMarks])

	const closeCalendar = () => {
		setOpenCalendar(false)
		setHistoryExpanded(false)
	}
	const goToDate = key => {
		if (key > todayKey) return
		emit(DATE_SELECTED, key)
		closeCalendar()
		setSelected(null)
	}
	const goToday = () => {
		setSelected(null)
		const list = monthListRef.current
		const target = list?.querySelector(`[data-month-key="${monthKey(today)}"]`)
		if (list && target) list.scrollTo({ top: target.offsetTop - list.offsetTop, behavior: 'smooth' })
	}

	return <>
		<aside className={`${s.sidebar} ${openCalendar ? s.active : ''}`}>
			<div className={s.header}>
				<span className={s.title}>Календарь</span>
				<button className={s.iconBtn} onClick={closeCalendar} aria-label="Закрыть" data-help="Закрыть календарь и вернуться к дневнику."><CloseIcon fontSize="small" /></button>
			</div>
			<div className={s.monthList} ref={monthListRef}>
				<button
					className={s.historyToggle}
					type="button"
					onClick={() => setHistoryExpanded(expanded => !expanded)}
					data-help={historyExpanded
						? 'Нажмите, чтобы свернуть старые месяцы.'
						: 'Нажмите, чтобы увидеть историю приступов за прошлые месяцы.'}
				>
					{historyExpanded ? 'Свернуть историю' : 'Развернуть историю'}
				</button>
				{months.map(({ date, key: monthId, grid }) => <section className={s.monthBlock} key={monthId} data-month-key={monthId}>
					<div className={s.monthSeparator} aria-hidden="true">
						<span>{date.getFullYear()}</span>
					</div>
					<div className={s.monthHeading}>
						<span className={`${s.monthName} ${monthKey(date) === todayKey.slice(0, 7) ? s.currentMonthName : ''}`}>{MONTHS[date.getMonth()]}</span>
					</div>
					<div className={s.weekRow}>{WEEKDAYS.map((day, index) => <span key={day} className={`${s.weekLabel} ${index >= 5 ? s.weekend : ''}`}>{day}</span>)}</div>
					<div className={s.grid}>
						{grid.map(({ date: dayDate, current }, index) => {
							if (!dayDate) return <span key={`empty-${monthId}-${index}`} className={s.cellPlaceholder} aria-hidden="true" />
							const key = dateKey(dayDate)
							const dayMarks = [...(marks[key] ?? [])]
							const isFuture = key > todayKey
							return <button key={key + current}
								className={[s.cell, !current && s.cellOther, key === todayKey && s.cellToday, (selected === key || (!selected && current && key === currentDateKey)) && s.cellSelected, isFuture && s.cellFuture].filter(Boolean).join(' ')}
								onClick={() => setSelected(selected === key ? null : key)}
								data-help={`Выбрать ${dayDate.getDate()} ${MONTHS[dayDate.getMonth()]} и открыть записи дневника за этот день.`}
								aria-current={current && key === currentDateKey ? 'date' : undefined}
								disabled={!current || isFuture} tabIndex={current && !isFuture ? 0 : -1}>
								<span className={s.cellNum}>{dayDate.getDate()}</span>
								{dayMarks.length > 0 && <span className={s.dotRow}>{dayMarks.map(type => <span key={type} className={s.dot} style={{ background: MARK_TYPES[type]?.color }} />)}</span>}
							</button>
						})}
					</div>
				</section>)}
			</div>
			<div className={s.footer}>
				{selected && <div className={s.actionPanel}>
				<span className={s.actionPanelDate}>{selected.split('-').reverse().slice(0, 2).join('.')}</span>
				<div className={s.actionList}><button className={s.actionBtn} onClick={() => goToDate(selected)} data-help="Открыть дневник за выбранную в календаре дату.">
					<span className={s.actionIcon}><ArrowForwardIcon fontSize="small" /></span><span className={s.actionLabel}>Перейти к дате</span>
				</button></div>
				</div>}
				<button className={s.todayLink} onClick={goToday}><BackIcon style={{ fontSize: '1rem' }} /> К текущему месяцу</button>
				<div className={s.legend}>{Object.entries(MARK_TYPES).map(([type, { label, color }]) => <div key={type} className={s.legendItem}>
					<span className={s.dot} style={{ background: color }} /><span>{label}</span>
				</div>)}</div>
			</div>
		</aside>
		{openCalendar && <div className={s.overlay} onClick={closeCalendar} />}
	</>
}

export default SidebarCalendar
