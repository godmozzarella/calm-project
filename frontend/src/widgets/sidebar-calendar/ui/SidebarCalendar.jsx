import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { BackIcon, ArrowForwardIcon } from '@/shared/ui/icons'
import CloseButton from '@/shared/ui/Button/CloseButton'
import { attackApi, medicationApi } from '@/shared/api'
import { questionnaireApi } from '@/shared/api/questionnaireApi'
import { notifyRequestError } from '@/shared/lib/notifyError'
import CheckIcon from '@mui/icons-material/Check'
import { subscribe, emit, ATTACKS_CHANGED, MEDICATIONS_CHANGED, PROFILE_CHANGED, CYCLE_CHANGED, DATE_SELECTED, SURVEY_COMPLETED } from '@/shared/lib/dataEvents'
import s from './SidebarCalendar.module.scss'

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS_BACK_INITIAL = 1
const MONTHS_BACK_MAX = 60
const MONTHS_FORWARD = 12
const MARK_TYPES = {
	headache: { label: 'Приступ', color: 'var(--error-color)' },
	medication: { label: 'Лекарство', color: 'var(--success-color)' },
	note: { label: 'Заметка', color: '#eab308' },
	survey: { label: 'Опрос пройден', color: 'var(--fc-contrast)' },
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
	const todayMonthKey = monthKey(today)
	const currentDateKey = dateKey(currentDate)
	const [selected, setSelected] = useState(null)
	const [marks, setMarks] = useState({})
	const [surveyDates, setSurveyDates] = useState(() => new Set())
	const [cycleMarks, setCycleMarks] = useState([])
	const [cycleProfile, setCycleProfile] = useState(null)
	const [cycleOverview, setCycleOverview] = useState(null)
	const [cycleEdit, setCycleEdit] = useState(false)
	const [cycleRangeStart, setCycleRangeStart] = useState(null)
	const [cycleBusy, setCycleBusy] = useState(false)
	const cycleDays = useMemo(() => new Set(cycleMarks.filter(mark => mark.kind === 'DAY').map(mark => mark.date)), [cycleMarks])
	const closedCycleDays = useMemo(() => new Set(cycleMarks.filter(mark => mark.kind === 'CLOSED').map(mark => mark.date)), [cycleMarks])
	const plannedCycleDays = useMemo(() => {
		const days = new Map()
		for (const mark of cycleMarks) {
			if (mark.kind !== 'PLANNED') continue
			const end = mark.plannedEnd ?? mark.date
			for (const date = new Date(`${mark.date}T12:00:00`); dateKey(date) <= end; date.setDate(date.getDate() + 1)) {
				days.set(dateKey(date), mark.date)
			}
		}
		return days
	}, [cycleMarks])
	const ongoingStart = cycleOverview?.state === 'ONGOING'
		? cycleOverview.history.findLast(period => !period.planned)?.start : null
	const [historyExpanded, setHistoryExpanded] = useState(false)
	const monthListRef = useRef(null)
	const historyAnchor = useRef(null)
	const months = useMemo(() => {
		const todayMonth = monthIndex(new Date(`${todayKey}T12:00:00`))
        const currentDiaryMonth = monthIndex(new Date(`${currentDateKey}T12:00:00`))
		const first = Math.min(todayMonth - (historyExpanded ? MONTHS_BACK_MAX : MONTHS_BACK_INITIAL), currentDiaryMonth)
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
	const loadCycle = useCallback(async () => {
		const [profile, markers, overview] = await Promise.allSettled([
			questionnaireApi.getProfile(), questionnaireApi.cycleMarks(), questionnaireApi.cycleOverview(),
		])
		if (profile.status === 'fulfilled') setCycleProfile(profile.value)
		if (markers.status === 'fulfilled') setCycleMarks(markers.value)
		setCycleOverview(overview.status === 'fulfilled' ? overview.value : null)
		const failed = [profile, markers].find(result => result.status === 'rejected')
		if (failed) notifyRequestError(failed.reason, 'Не удалось загрузить отметки цикла')
	}, [])
	const loadSurveyDates = useCallback(() => {
		questionnaireApi.completedDates()
			.then(dates => setSurveyDates(new Set(dates)))
			.catch(() => {})
	}, [])
	useEffect(() => { if (openCalendar) loadMarks() }, [openCalendar, loadMarks])
	useEffect(() => { if (openCalendar) loadCycle() }, [openCalendar, loadCycle])
	useEffect(() => { if (openCalendar) loadSurveyDates() }, [openCalendar, loadSurveyDates])
	useEffect(() => {
		if (!openCalendar) {
			setCycleRangeStart(null)
			setHistoryExpanded(false)
			setCycleEdit(false)
			return
		}
		setSelected(null)
		setHistoryExpanded(false)
	}, [openCalendar, currentDateKey])
	useLayoutEffect(() => {
		if (!openCalendar) return
		const list = monthListRef.current
		const target = list?.querySelector(`[data-month-key="${todayMonthKey}"]`)
		if (list && target) list.scrollTop = target.offsetTop - list.offsetTop
	}, [openCalendar, todayMonthKey])
	useLayoutEffect(() => {
		const anchor = historyAnchor.current
		if (!anchor) return
		historyAnchor.current = null
		const list = monthListRef.current
		const month = list?.querySelector(`[data-month-key="${anchor.key}"]`)
		if (month) list.scrollTop += month.getBoundingClientRect().top - list.getBoundingClientRect().top - anchor.offset
		else if (list) list.scrollTop = 0
	}, [historyExpanded])
	useEffect(() => subscribe(ATTACKS_CHANGED, loadMarks), [loadMarks])
	useEffect(() => subscribe(MEDICATIONS_CHANGED, loadMarks), [loadMarks])
	useEffect(() => subscribe(PROFILE_CHANGED, loadCycle), [loadCycle])
	useEffect(() => subscribe(CYCLE_CHANGED, loadCycle), [loadCycle])
	useEffect(() => subscribe(SURVEY_COMPLETED, loadSurveyDates), [loadSurveyDates])
	const selectCycleRange = async date => {
		if (cycleBusy) return
		if (cycleDays.has(date)) {
			await removeCycleDay(date)
			return
		}
		const planStart = plannedCycleDays.get(date)
		if (planStart) {
			await removeCycleDay(planStart, 'PLANNED')
			return
		}
		const start = cycleRangeStart || date
		if (date < start) return
		if (!cycleRangeStart) setCycleRangeStart(date)
		setCycleBusy(true)
		try {
			await questionnaireApi.putCycleRange(start, date)
			await loadCycle()
			if (cycleRangeStart) setCycleRangeStart(null)
		} catch (error) {
			if (!cycleRangeStart) setCycleRangeStart(null)
			notifyRequestError(error, cycleRangeStart ? 'Не удалось сохранить весь период' : 'Не удалось отметить начало месячных')
			await loadCycle()
		}
		finally { setCycleBusy(false) }
	}
	const removeCycleDay = async (date, kind = 'DAY') => {
		if (cycleBusy) return
		setCycleBusy(true)
		try {
			await questionnaireApi.deleteCycleMark(date, kind)
			if (date === cycleRangeStart) setCycleRangeStart(null)
			await loadCycle()
		} catch (error) { notifyRequestError(error, 'Не удалось убрать отметку менструации') }
		finally { setCycleBusy(false) }
	}
	const toggleCycleEnd = async date => {
		if (cycleBusy) return
		setCycleBusy(true)
		try {
			if (closedCycleDays.has(date)) await questionnaireApi.deleteCycleMark(date, 'CLOSED')
			else if (ongoingStart && date > ongoingStart) await questionnaireApi.putCycleRange(ongoingStart, date)
			else await questionnaireApi.putCycleMark(date, 'CLOSED')
			await loadCycle()
		} catch (error) { notifyRequestError(error, 'Не удалось сохранить конец менструации') }
		finally { setCycleBusy(false) }
	}

	const closeCalendar = () => {
		setOpenCalendar(false)
		setHistoryExpanded(false)
		setCycleEdit(false)
		setCycleRangeStart(null)
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
		const target = list?.querySelector(`[data-month-key="${todayMonthKey}"]`)
		if (list && target) list.scrollTo({ top: target.offsetTop - list.offsetTop, behavior: 'smooth' })
	}
	const toggleHistory = () => {
		const list = monthListRef.current
		const top = list.getBoundingClientRect().top
		const visibleMonth = Array.from(list.querySelectorAll('[data-month-key]'))
			.find(month => month.getBoundingClientRect().bottom > top)
		historyAnchor.current = visibleMonth
			? { key: visibleMonth.dataset.monthKey, offset: visibleMonth.getBoundingClientRect().top - top }
			: null
		setHistoryExpanded(expanded => !expanded)
	}

	return <>
		<aside className={`${s.sidebar} ${openCalendar ? s.active : ''}`}>
			<div className={s.header}>
				<span className={s.title}>Календарь</span>
				<div className={s.headerActions}>
					<CloseButton label="Закрыть календарь" title="Закрыть календарь и вернуться к дневнику." onClick={closeCalendar} />
				</div>
			</div>
			<button className={s.historyToggle} type="button" onClick={toggleHistory} aria-expanded={historyExpanded}>
				{historyExpanded ? 'Свернуть историю' : 'Развернуть историю'}
			</button>
			<div className={s.monthList} ref={monthListRef}>
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
							if (surveyDates.has(key)) dayMarks.push('survey')
							const isCycleDay = cycleProfile?.sex === 'FEMALE' && cycleDays.has(key)
							const isPlanned = cycleProfile?.sex === 'FEMALE' && !isCycleDay && plannedCycleDays.has(key)
							const isFuture = key > todayKey
							const cycleAction = isPlanned ? 'Убрать запланированный период' : isCycleDay ? 'Снять отметку'
								: cycleRangeStart ? 'Выбрать последний день' : 'Отметить начало'
							const outsideRange = cycleEdit && cycleRangeStart && !isCycleDay && !isPlanned &&
								key < cycleRangeStart
							return <button key={key + current}
								data-date={key}
								className={[s.cell, !current && s.cellOther, key === todayKey && s.cellToday, !cycleEdit && (selected === key || (!selected && current && key === currentDateKey)) && s.cellSelected, (isCycleDay || cycleEdit && key === cycleRangeStart) && s.cellCycle, isPlanned && s.cellPlanned, isFuture && !cycleEdit && !isPlanned && s.cellFuture].filter(Boolean).join(' ')}
								onClick={() => cycleEdit ? selectCycleRange(key) : setSelected(selected === key ? null : key)}
								title={cycleEdit ? `${cycleAction} — ${dayDate.getDate()} ${MONTHS[dayDate.getMonth()]}.` : isPlanned ? 'Запланированный день менструации' : closedCycleDays.has(key) ? `Последний день менструации — ${dayDate.getDate()} ${MONTHS[dayDate.getMonth()]}. Нажмите, чтобы изменить.` : `Выбрать ${dayDate.getDate()} ${MONTHS[dayDate.getMonth()]} и открыть записи дневника за этот день.`}
								aria-label={cycleEdit ? `${dayDate.getDate()} ${MONTHS[dayDate.getMonth()]} — ${cycleAction}` : undefined}
								aria-pressed={cycleEdit ? isCycleDay || isPlanned || key === cycleRangeStart : undefined}
								aria-current={current && key === currentDateKey ? 'date' : undefined}
								disabled={!current || (!cycleEdit && isFuture) || (cycleEdit && cycleBusy) || Boolean(outsideRange)} tabIndex={current && (cycleEdit || !isFuture) ? 0 : -1}>
								<span className={s.cellNum}>{dayDate.getDate()}</span>
								{!cycleEdit && dayMarks.length > 0 && <span className={s.dotRow}>{dayMarks.map(type => <span key={type} className={s.dot} style={{ background: MARK_TYPES[type]?.color }} />)}</span>}
							</button>
						})}
					</div>
				</section>)}
			</div>
			<div className={s.footer}>
				{cycleEdit && <p className={s.cycleHint} role="status">
					{cycleBusy ? 'Сохраняем изменения…' : !cycleRangeStart ? 'Нажмите на первый день месячных.'
						: cycleRangeStart > todayKey ? 'Начало запланировано. Выберите последний день, чтобы отметить весь период.'
							: 'Начало сохранено. Если месячные уже закончились, выберите последний день.'}
				</p>}
				{!cycleEdit && cycleProfile?.sex === 'FEMALE' && cycleOverview?.statistics && <details className={s.cycleStats}>
					<summary>Статистика цикла</summary>
					<p>{({ NO_HISTORY: 'Отметок пока нет', ONGOING: 'Месячные идут', WAITING: 'Ожидается следующее начало' })[cycleOverview.state]}</p>
					<p>Длина цикла — {cycleOverview.statistics.cycleLength.toLocaleString('ru-RU')} дн., разброс — {cycleOverview.statistics.spread} дн.</p>
					<p>Длительность месячных — {cycleOverview.statistics.periodLength.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} дн.</p>
					<p>Уверенность — {({ LOW: 'низкая', MEDIUM: 'средняя', HIGH: 'высокая' })[cycleOverview.statistics.confidence]}</p>
				</details>}
				{selected && !cycleEdit && <div className={s.actionPanel}>
				<span className={s.actionPanelDate}>{selected.split('-').reverse().slice(0, 2).join('.')}</span>
				<div className={s.actionList}><button className={s.actionBtn} onClick={() => goToDate(selected)} title="Открыть дневник за выбранную в календаре дату.">
					<span className={s.actionIcon}><ArrowForwardIcon fontSize="small" /></span><span className={s.actionLabel}>Перейти к дате</span>
				</button>
					{cycleProfile?.sex === 'FEMALE' && (cycleDays.has(selected) || ongoingStart && selected >= ongoingStart) && <button className={s.actionBtn} type="button" disabled={cycleBusy} onClick={() => toggleCycleEnd(selected)}>
						<span className={s.actionIcon}><CheckIcon fontSize="small" /></span><span className={s.actionLabel}>{closedCycleDays.has(selected) ? 'Убрать отметку окончания' : 'Отметить окончание месячных'}</span>
					</button>}
					{cycleProfile?.sex === 'FEMALE' && cycleDays.has(selected) && <button className={s.actionBtn} type="button" disabled={cycleBusy} onClick={() => removeCycleDay(selected)}>
						<span className={s.actionLabel}>Убрать отметку менструации</span>
					</button>}
				</div>
				</div>}
				<div className={s.footerNav}>
					<button title={"К текущему месяцу"} className={s.todayLink} onClick={goToday}><BackIcon style={{ fontSize: '1rem' }} /> К текущему месяцу</button>
					{cycleProfile?.sex === 'FEMALE' && <button type="button" disabled={cycleBusy} className={s.cycleToggle} aria-pressed={cycleEdit} onClick={() => {setCycleEdit(value => !value);setSelected(null);setCycleRangeStart(null)}}>{cycleEdit ? 'Готово' : 'Отметить месячные'}</button>}
				</div>
				<div className={s.legend}>{Object.entries(MARK_TYPES).map(([type, { label, color }]) => <div key={type} className={s.legendItem}>
					<span className={s.dot} style={{ background: color }} /><span>{label}</span>
				</div>)}</div>
			</div>
		</aside>
		{openCalendar && <div className={s.overlay} onClick={closeCalendar} />}
	</>
}

export default SidebarCalendar
