import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import { adminApi } from '@/shared/api'
import { Input } from '@/shared/ui/Input'
import { notifyRequestError } from '@/shared/lib/notifyError'
import { PERIOD_OPTIONS } from '@/widgets/chart-section/lib/buckets'
import { countAxis, dateTicks, spacedDateLabels } from './attackChartAxes.mjs'
import { maxVisibleDaySpan, panViewport, readableViewport, visibleDayBounds, zoomViewport } from './attackChartViewport.mjs'
import s from './AttackStatsTab.module.scss'

const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const localDate = date => new Date(`${date}T12:00:00`)
const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' })
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' })
const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long' })
const fullDate = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'full' })
const periodDate = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' })
const integer = new Intl.NumberFormat('ru-RU')
const WIDTH = 752
const HEIGHT = 324
const LEFT = 58
const RIGHT_PADDING = 18
const TOP = 18
const BOTTOM = HEIGHT - 45
const PERIOD_DAYS = { week: 7, month: 30, '3months': 90, year: 52 * 7 }
const DATE_STEPS = [{ value: 'day', label: 'День' }, { value: 'week', label: 'Неделя' }, { value: 'month', label: 'Месяц' }]
const COUNT_STEPS = [1, 2, 5]

const periodStart = (last, period) => {
	const first = new Date(last)
	first.setDate(first.getDate() - PERIOD_DAYS[period] + 1)
	return dateKey(first)
}

const chartPosition = (clientX, bounds) => {
	return (clientX - bounds.left - LEFT) / Math.max(1, bounds.width - LEFT - RIGHT_PADDING)
}

const insideChart = value => Math.max(0, Math.min(1, value))
const midpointX = ([a, b]) => (a.x + b.x) / 2
const distance = ([a, b]) => Math.hypot(a.x - b.x, a.y - b.y)

function curve(points) {
	return points.reduce((path, point, index) => {
		if (index === 0) return `M ${point.x} ${point.y}`
		const previous = points[index - 1]
		const middle = (previous.x + point.x) / 2
		return `${path} C ${middle} ${previous.y} ${middle} ${point.y} ${point.x} ${point.y}`
	}, '')
}

function chartLayout(days, scale, right, xStep, yStep) {
	const peak = days.reduce((max, day) => Math.max(max, day.count), 0)
	const height = BOTTOM - TOP
	const { fraction, ticks } = countAxis(peak, yStep, scale, height)
	const y = count => BOTTOM - fraction(count) * height
	const countLabels = ticks(12)
	const grid = ticks(5).filter(tick => !countLabels.includes(tick))
	const x = index => days.length === 1 ? (LEFT + right) / 2 : LEFT + index / (days.length - 1) * (right - LEFT)
	const points = days.map((day, index) => ({ ...day, x: x(index), y: y(day.count) }))
	const dates = dateTicks(points, xStep)
	const dateLabels = spacedDateLabels(dates, xStep === 'month' ? 52 : 29)
	const gradientMax = peak || 1
	return {
		points, countLabels, grid, dates, dateLabels, y, peakY: y(gradientMax), line: curve(points),
		midpoint: fraction(gradientMax / 2) / fraction(gradientMax),
	}
}

function AttackChart({ days, from, to, scale, setScale, xStep, setXStep, yStep, setYStep }) {
	const gradientId = useId()
	const plot = useRef(null)
	const chartContainer = useRef(null)
	const pointers = useRef(new Map())
	const dragged = useRef(false)
	const [width, setWidth] = useState(WIDTH)
	const [view, setView] = useState(null)
	const [selected, setSelected] = useState(null)
	const lastIndex = days.length - 1
	const lastDate = days[lastIndex].date
	const right = width - RIGHT_PADDING
	const maxSpan = maxVisibleDaySpan(lastDate, lastIndex, xStep)
	const viewport = readableViewport(view, lastIndex, maxSpan)
	const [first, last] = visibleDayBounds(viewport, lastIndex)
	const { points, countLabels, grid, dates, dateLabels, y, peakY, line, midpoint } = useMemo(
		() => chartLayout(days.slice(first, last + 1), scale, right, xStep, yStep),
		[days, first, last, scale, right, xStep, yStep],
	)
	const total = useMemo(() => days.reduce((sum, day) => sum + day.count, 0), [days])
	const activeIndex = Math.max(first, Math.min(last, selected ?? last))
	const point = points[activeIndex - first]
	const canPan = viewport !== null
	const firstYear = days[first].date.slice(0, 4)
	const lastYear = days[last].date.slice(0, 4)
	const yearLabel = firstYear === lastYear ? firstYear : `${firstYear}–${lastYear}`
	const changeDateStep = step => {
		if (step === xStep) return
		const nextMaxSpan = maxVisibleDaySpan(lastDate, lastIndex, step)
		if (nextMaxSpan !== maxSpan) {
			setView(current => current && zoomViewport(readableViewport(current, lastIndex, maxSpan), lastIndex,
				maxSpan / nextMaxSpan, 0.5, 0.5, nextMaxSpan))
		}
		setXStep(step)
	}

	useEffect(() => {
		const observer = new ResizeObserver(([entry]) => {
			const measuredWidth = Math.floor(entry.contentRect.width)
			if (measuredWidth > LEFT + RIGHT_PADDING) setWidth(measuredWidth)
		})
		observer.observe(chartContainer.current)
		return () => observer.disconnect()
	}, [])

	const zoom = useCallback((factor, anchor = 0.5, target = anchor) => {
		setView(current => zoomViewport(readableViewport(current, lastIndex, maxSpan), lastIndex, factor, anchor, target, maxSpan))
	}, [lastIndex, maxSpan])
	const pan = useCallback(fraction => {
		setView(current => panViewport(readableViewport(current, lastIndex, maxSpan), lastIndex, fraction))
	}, [lastIndex, maxSpan])

	useEffect(() => {
		const element = plot.current
		const activePointers = pointers.current
		if (lastIndex <= 1) return
		const wheel = event => {
			const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1
			const bounds = element.getBoundingClientRect()
			if (!event.ctrlKey && !event.metaKey) {
				if (!canPan || (!event.shiftKey && Math.abs(event.deltaX) <= Math.abs(event.deltaY))) return
				event.preventDefault()
				const horizontal = event.deltaX || event.deltaY
				pan(horizontal * unit / Math.max(1, bounds.width - LEFT - RIGHT_PADDING))
				return
			}
			event.preventDefault()
			const anchor = insideChart(chartPosition(event.clientX, bounds))
			const pixels = event.deltaY * unit
			const factor = Math.exp(-Math.max(-160, Math.min(160, pixels)) * 0.006)
			zoom(factor, anchor)
		}
		// Safari trackpads report pinch gestures separately from wheel events.
		let gestureScale = 1
		const gestureStart = event => {
			if (activePointers.size) return
			event.preventDefault()
			gestureScale = 1
		}
		const gestureChange = event => {
			if (activePointers.size || !(event.scale > 0)) return
			event.preventDefault()
			const bounds = element.getBoundingClientRect()
			const anchor = Number.isFinite(event.clientX) ? insideChart(chartPosition(event.clientX, bounds)) : 0.5
			const factor = event.scale / gestureScale
			gestureScale = event.scale
			zoom(factor, anchor)
		}
		element.addEventListener('wheel', wheel, { passive: false })
		element.addEventListener('gesturestart', gestureStart, { passive: false })
		element.addEventListener('gesturechange', gestureChange, { passive: false })
		return () => {
			element.removeEventListener('wheel', wheel)
			element.removeEventListener('gesturestart', gestureStart)
			element.removeEventListener('gesturechange', gestureChange)
		}
	}, [lastIndex, canPan, pan, zoom])

	const locate = event => {
		const position = insideChart(chartPosition(event.clientX, event.currentTarget.getBoundingClientRect()))
		setSelected(first + Math.round(position * (last - first)))
	}
	const beginPointer = event => {
		if (event.button !== 0 || pointers.current.size >= 2) return
		if (pointers.current.size === 0) dragged.current = false
		if (pointers.current.size === 1) dragged.current = true
		pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
		event.currentTarget.setPointerCapture(event.pointerId)
	}
	const movePointer = event => {
		const previous = pointers.current.get(event.pointerId)
		if (!previous) {
			if (event.pointerType === 'mouse') locate(event)
			return
		}
		const before = [...pointers.current.values()]
		const next = { x: event.clientX, y: event.clientY }
		pointers.current.set(event.pointerId, next)
		const bounds = event.currentTarget.getBoundingClientRect()
		const ratio = x => chartPosition(x, bounds)
		if (before.length === 2) {
			const after = [...pointers.current.values()]
			const factor = Math.max(1, distance(after)) / Math.max(1, distance(before))
			const anchor = insideChart(ratio(midpointX(before)))
			const target = insideChart(ratio(midpointX(after)))
			zoom(factor, anchor, target)
		} else if (canPan && next.x !== previous.x) {
			dragged.current = true
			pan(ratio(previous.x) - ratio(next.x))
		}
	}
	const endPointer = event => { pointers.current.delete(event.pointerId) }
	const moveSelection = event => {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
		event.preventDefault()
		const direction = event.key === 'ArrowLeft' ? -1 : 1
		const target = Math.max(0, Math.min(lastIndex, activeIndex + direction))
		if (viewport && (target < first || target > last)) pan(direction / viewport.span)
		setSelected(target)
	}

	return <figure className={s.figure}>
		<figcaption className={s.summary}>
			<span>{periodDate.formatRange(localDate(from), localDate(to))} · всего <strong>{integer.format(total)}</strong></span>
			<span>{fullDate.format(localDate(point.date))} · <strong>{integer.format(point.count)}</strong></span>
		</figcaption>
		<div className={s.chartControls}>
			<div className={s.scales} role="group" aria-label="Шкала количества приступов">
				<button type="button" aria-pressed={scale === 'linear'} onClick={() => setScale('linear')}>Обычная шкала</button>
				<button type="button" aria-pressed={scale === 'log'} onClick={() => setScale('log')}>Логарифмическая</button>
			</div>
			<div className={s.scales} role="group" aria-label="Приближение графика">
				<button type="button" aria-label="Приблизить" disabled={lastIndex <= 1 || viewport?.span === 1}
					onClick={() => zoom(1.6)}>+</button>
				<button type="button" aria-label="Отдалить" disabled={!viewport || viewport.span >= maxSpan}
					onClick={() => zoom(1 / 1.6)}>−</button>
				<button type="button" disabled={!view} onClick={() => setView(null)}>Сбросить масштаб</button>
			</div>
		</div>
		<div className={s.axisControls}>
			<div className={s.scales} role="group" aria-label="Шаг по оси X">
				<span className={s.axisLabel} aria-hidden="true">Ось X</span>
				{DATE_STEPS.map(({ value, label }) => <button type="button" key={value}
					aria-pressed={xStep === value} onClick={() => changeDateStep(value)}>{label}</button>)}
			</div>
			<div className={s.scales} role="group" aria-label="Шаг по оси Y">
				<span className={s.axisLabel} aria-hidden="true">Ось Y</span>
				{COUNT_STEPS.map(value => <button type="button" key={value}
					aria-pressed={yStep === value} onClick={() => setYStep(value)}>{value}</button>)}
			</div>
		</div>
		<div ref={chartContainer} className={s.chartScroll}>
			<svg ref={plot} className={`${s.chart} ${canPan ? s.pannable : ''}`} viewBox={`0 0 ${width} ${HEIGHT}`} height={HEIGHT} tabIndex={0} role="group"
				aria-label={`Приступы по дням. ${fullDate.format(localDate(point.date))}, ${integer.format(point.count)}. Используйте стрелки для выбора даты.`}
				onKeyDown={moveSelection} onPointerDown={beginPointer} onPointerMove={movePointer} onPointerUp={endPointer}
				onPointerCancel={endPointer} onLostPointerCapture={endPointer}
				onClick={event => { if (!dragged.current) locate(event) }}>
				<defs>
					<linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={BOTTOM} y2={peakY}>
						<stop offset="0%" className={s.low} />
						<stop offset={midpoint} className={s.medium} />
						<stop offset="100%" className={s.high} />
					</linearGradient>
				</defs>
				{grid.map(tick => <line key={tick} className={s.minorGrid} x1={LEFT} x2={right} y1={y(tick)} y2={y(tick)} />)}
				{countLabels.map(tick => <g key={tick}>
					<line className={s.grid} x1={LEFT} x2={right} y1={y(tick)} y2={y(tick)} />
					<text className={s.axis} x={LEFT - 10} y={y(tick)} dy=".35em" textAnchor="end">{integer.format(tick)}</text>
				</g>)}
				{dates.map(({ date, x }) => <line className={s.dateTick} key={date} x1={x} x2={x} y1={BOTTOM} y2={BOTTOM + 4} />)}
				{dateLabels.map(({ date, x }) => {
					const labelDate = localDate(date)
					if (xStep === 'month') return <text className={s.axis} key={date} x={Math.min(x, right - 7)} y={BOTTOM + 15} textAnchor="middle">
						{monthName.format(labelDate)}
					</text>
					return <text className={s.axis} key={date} x={x} y={BOTTOM + 15} textAnchor="middle">
						<tspan x={x}>{weekday.format(labelDate)}</tspan>
						<tspan x={x} dy="13">{shortDate.format(labelDate)}</tspan>
					</text>
				})}
				{xStep === 'month' && <text className={s.axis} x={LEFT} y={BOTTOM + 29}>{yearLabel}</text>}
				<line className={s.selectedDay} x1={point.x} x2={point.x} y1={TOP} y2={BOTTOM} />
				{points.length > 1 && <path className={s.line} d={line} stroke={`url(#${gradientId})`} />}
				<circle className={s.marker} cx={point.x} cy={point.y} r="4.5" fill={`url(#${gradientId})`} />
			</svg>
		</div>
	</figure>
}

export default function AttackStatsTab() {
	const now = new Date()
	const today = dateKey(now)
	const [period, setPeriod] = useState('week')
	const [from, setFrom] = useState(() => periodStart(now, 'week'))
	const [to, setTo] = useState(today)
	const [snapshot, setSnapshot] = useState(null)
	const [scale, setScale] = useState('linear')
	const [xStep, setXStep] = useState('week')
	const [yStep, setYStep] = useState(1)
	const [loading, setLoading] = useState(false)
	const [dateError, setDateError] = useState('')
	const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
	const allTime = period === 'all'

	const choosePeriod = value => {
		setPeriod(value)
		setDateError('')
		if (value === 'custom') return
		setTo(today)
		if (value !== 'all') setFrom(periodStart(now, value))
	}

	const refresh = async event => {
		event.preventDefault()
		if (loading) return
		if (!to || !allTime && (!from || from > to)) {
			setDateError('Укажите дату окончания не раньше даты начала.')
			return
		}
		setDateError('')
		setLoading(true)
		try {
			const days = await adminApi.getAttackCounts(allTime ? null : from, to, timezone)
			setSnapshot({ from: days[0].date, to, days })
		} catch (error) {
			notifyRequestError(error, 'Не удалось обновить статистику приступов')
		} finally {
			setLoading(false)
		}
	}

	return <section className={s.section} aria-busy={loading}>
		<h2 className={s.heading}>Добавленные приступы по дням</h2>
		<form className={s.filters} onSubmit={refresh}>
			<div className={s.periods} role="group" aria-label="Период статистики">
				{[...PERIOD_OPTIONS, { value: 'custom', label: 'Свой период' }].map(({ value, label }) => (
					<button type="button" key={value} disabled={loading} aria-pressed={period === value}
						onClick={() => choosePeriod(value)}>{value === 'all' ? 'За всё время' : label}</button>
				))}
			</div>
			<div className={s.dateFilters}>
				{!allTime && <div className={s.dateRange}>
					<Input type="date" label="Начало периода" value={from} max={today} required disabled={loading}
						onChange={event => { setFrom(event.target.value); choosePeriod('custom') }} />
					<Input type="date" label="Конец периода" value={to} max={today} required disabled={loading} error={dateError}
						onChange={event => { setTo(event.target.value); choosePeriod('custom') }} />
				</div>}
				<button className={s.refresh} type="submit" disabled={loading} aria-busy={loading}
					aria-label="Обновить статистику" title={loading ? 'Обновляем статистику…' : 'Обновить статистику'}>
					<RefreshRoundedIcon fontSize="small" />
				</button>
			</div>
		</form>
		{snapshot && <AttackChart key={`${snapshot.from}/${snapshot.to}`} {...snapshot} scale={scale} setScale={setScale}
			xStep={xStep} setXStep={setXStep} yStep={yStep} setYStep={setYStep} />}
	</section>
}
