import { useCallback, useEffect, useState } from 'react'

import { BackIcon, CloseIcon, ChevronLeftIcon, ChevronRightIcon, ArrowForwardIcon } from '@/shared/ui/icons'
import { attackApi, medicationApi } from '@/shared/api'
import { subscribe, emit, ATTACKS_CHANGED, MEDICATIONS_CHANGED, DATE_SELECTED } from '@/shared/lib/dataEvents'
import s from './SidebarCalendar.module.scss'

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MARK_TYPES = {
	headache: { label: 'Приступ', color: '#ef4444' },
	medication: { label: 'Лекарство', color: '#5cade4' },
	note: { label: 'Заметка', color: '#eab308' },
}

const midnight = (d = new Date()) => {
	const copy = new Date(d)
	copy.setHours(0, 0, 0, 0)
	return copy
}
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const buildGrid = (year, month) => {
	const first = new Date(year, month, 1)
	const lastDate = new Date(year, month + 1, 0).getDate()
	const startDow = first.getDay() === 0 ? 6 : first.getDay() - 1
	const days = []
	for (let i = startDow - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), current: false })
	for (let i = 1; i <= lastDate; i++) days.push({ date: new Date(year, month, i), current: true })
	const tail = 7 - (days.length % 7)
	if (tail < 7) for (let i = 1; i <= tail; i++) days.push({ date: new Date(year, month + 1, i), current: false })
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

const SidebarCalendar = ({ openCalendar, setOpenCalendar }) => {
	const today = midnight()
	const todayKey = dateKey(today)
	const [viewYear, setViewYear] = useState(today.getFullYear())
	const [viewMonth, setViewMonth] = useState(today.getMonth())
	const [selected, setSelected] = useState(null)
	const [marks, setMarks] = useState({})

	const loadMarks = useCallback(() => {
		Promise.all([attackApi.getAll(), medicationApi.getAll()])
			.then(([attacks, medications]) => setMarks(marksFromEntries(attacks, medications)))
			.catch(() => {})
	}, [])
	useEffect(() => { if (openCalendar) loadMarks() }, [openCalendar, loadMarks])
	useEffect(() => subscribe(ATTACKS_CHANGED, loadMarks), [loadMarks])
	useEffect(() => subscribe(MEDICATIONS_CHANGED, loadMarks), [loadMarks])

	const prevMonth = () => {
		if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
		else setViewMonth(m => m - 1)
		setSelected(null)
	}
	const nextMonth = () => {
		if (viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth >= today.getMonth())) return
		if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
		else setViewMonth(m => m + 1)
		setSelected(null)
	}
	const goToDate = key => {
		if (key > todayKey) return
		emit(DATE_SELECTED, key)
		setOpenCalendar(false)
		setSelected(null)
	}
	const goToday = () => {
		setViewYear(today.getFullYear())
		setViewMonth(today.getMonth())
		setSelected(null)
	}
	const isViewingCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth()

	return <>
		<aside className={`${s.sidebar} ${openCalendar ? s.active : ''}`}>
			<div className={s.header}>
				<span className={s.title}>Календарь</span>
				<button className={s.iconBtn} onClick={() => setOpenCalendar(false)} aria-label="Закрыть"><CloseIcon fontSize="small" /></button>
			</div>
			<div className={s.monthNav}>
				<button className={s.navBtn} onClick={prevMonth} aria-label="Предыдущий месяц"><ChevronLeftIcon fontSize="small" /></button>
				<div className={s.monthInfo}><span className={s.monthName}>{MONTHS[viewMonth]}</span><span className={s.yearLabel}>{viewYear}</span></div>
				<button className={s.navBtn} onClick={nextMonth} disabled={isViewingCurrentMonth} aria-label="Следующий месяц"><ChevronRightIcon fontSize="small" /></button>
			</div>
			<div className={s.weekRow}>{WEEKDAYS.map(d => <span key={d} className={s.weekLabel}>{d}</span>)}</div>
			<div className={s.grid}>
				{buildGrid(viewYear, viewMonth).map(({ date, current }) => {
					const key = dateKey(date)
					const dayMarks = [...(marks[key] ?? [])]
					const isFuture = key > todayKey
					return <button key={key + current}
						className={[s.cell, !current && s.cellOther, key === todayKey && s.cellToday, selected === key && s.cellSelected, isFuture && s.cellFuture].filter(Boolean).join(' ')}
						onClick={() => setSelected(selected === key ? null : key)}
						disabled={!current || isFuture} tabIndex={current && !isFuture ? 0 : -1}>
						<span className={s.cellNum}>{date.getDate()}</span>
						{dayMarks.length > 0 && <span className={s.dotRow}>{dayMarks.map(type => <span key={type} className={s.dot} style={{ background: MARK_TYPES[type]?.color }} />)}</span>}
					</button>
				})}
			</div>
			{selected && <div className={s.actionPanel}>
				<span className={s.actionPanelDate}>{selected.split('-').reverse().slice(0, 2).join('.')}</span>
				<div className={s.actionList}><button className={s.actionBtn} onClick={() => goToDate(selected)}>
					<span className={s.actionIcon}><ArrowForwardIcon fontSize="small" /></span><span className={s.actionLabel}>Перейти к дате</span>
				</button></div>
			</div>}
			<div className={s.spacer} />
			<div className={s.footer}>
				{!isViewingCurrentMonth && <button className={s.todayLink} onClick={goToday}><BackIcon style={{ fontSize: '1rem' }} /> К текущему месяцу</button>}
				<div className={s.legend}>{Object.entries(MARK_TYPES).map(([type, { label, color }]) => <div key={type} className={s.legendItem}>
					<span className={s.dot} style={{ background: color }} /><span>{label}</span>
				</div>)}</div>
			</div>
		</aside>
		{openCalendar && <div className={s.overlay} onClick={() => setOpenCalendar(false)} />}
	</>
}

export default SidebarCalendar
