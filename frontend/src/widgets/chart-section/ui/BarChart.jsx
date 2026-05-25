import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { intensityColor } from '@/entities/attack'
import { pickLabelIndices } from '../lib/buckets'
import s from './BarChart.module.scss'

const H = 240
const PAD_L = 36
const PAD_R = 12
const PAD_T = 22  // под badge с count
const PAD_B = 28  // под X-подписи
const MIN_W = 280

const TOOLTIP_W = 200 // приблизительная ширина для clamp

const COUNT_COLOR = '#5cade4'

const formatTooltipDate = bucket => {
	if (bucket.fromKey === bucket.toKey) {
		const [y, m, d] = bucket.fromKey.split('-')
		return `${Number(d)}.${m}.${y}`
	}
	const [, m1, d1] = bucket.fromKey.split('-')
	const [, m2, d2] = bucket.toKey.split('-')
	return `${Number(d1)}.${m1} — ${Number(d2)}.${m2}`
}

const BarChart = ({ buckets, metric, onBarClick }) => {
	const wrapRef = useRef(null)
	const [w, setW] = useState(MIN_W)
	const [hover, setHover] = useState(null)

	useLayoutEffect(() => {
		if (!wrapRef.current) return
		setW(Math.max(MIN_W, Math.round(wrapRef.current.getBoundingClientRect().width)))
		const ro = new ResizeObserver(([entry]) => {
			setW(Math.max(MIN_W, Math.round(entry.contentRect.width)))
		})
		ro.observe(wrapRef.current)
		return () => ro.disconnect()
	}, [])

	if (buckets.length === 0) {
		return <div className={s.empty}>Нет данных для отображения</div>
	}

	const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0)
	const maxScale = metric === 'intensity' ? 10 : Math.max(1, maxCount)

	const innerW = w - PAD_L - PAD_R
	const innerH = H - PAD_T - PAD_B
	const barW = innerW / buckets.length
	const barGap = Math.min(barW * 0.25, 4)
	const drawW = Math.max(1, barW - barGap)

	const yTicks = metric === 'intensity'
		? [0, 5, 10]
		: [0, Math.ceil(maxScale / 2), maxScale]

	// На узких экранах X-подписи становятся каше — прячем их совсем.
	// Так же страхуемся: если на бакет приходится <16px — не рисуем.
	const showXLabels = w >= 420 && barW >= 16
	const labelIdx = showXLabels ? pickLabelIndices(buckets.length) : new Set()

	// геометрия tooltip — pixel left + transform, clamp к границам контейнера
	let tooltipLeft = 0
	let tooltipTransform = 'translateX(-50%)'
	if (hover !== null) {
		const cx = PAD_L + barW * hover + barW / 2
		const half = TOOLTIP_W / 2
		if (cx - half < 4) {
			tooltipLeft = 4
			tooltipTransform = 'translateX(0)'
		} else if (cx + half > w - 4) {
			tooltipLeft = w - 4
			tooltipTransform = 'translateX(-100%)'
		} else {
			tooltipLeft = cx
			tooltipTransform = 'translateX(-50%)'
		}
	}

	return (
		<div ref={wrapRef} className={s.wrap}>
			<svg
				width={w}
				height={H}
				viewBox={`0 0 ${w} ${H}`}
				className={s.svg}
			>
				{/* horizontal grid */}
				{yTicks.map(t => {
					const y = PAD_T + innerH - (t / maxScale) * innerH
					return (
						<g key={t}>
							<line x1={PAD_L} x2={w - PAD_R} y1={y} y2={y} className={s.grid} />
							<text x={PAD_L - 6} y={y + 3} className={s.yLabel} textAnchor="end">
								{t}
							</text>
						</g>
					)
				})}

				{/* bars */}
				{buckets.map((b, i) => {
					const value = metric === 'intensity' ? b.maxIntensity : b.count
					const x = PAD_L + barW * i + barGap / 2
					const ratio = value > 0 ? value / maxScale : 0
					const barH = ratio * innerH
					const y = PAD_T + innerH - barH

					const isEmpty = b.count === 0
					const fill = isEmpty
						? 'rgba(255,255,255,0.06)'
						: metric === 'intensity'
							? intensityColor(b.maxIntensity)
							: COUNT_COLOR

					const baselineY = PAD_T + innerH
					const minDot = 3

					return (
						<g
							key={b.key}
							onMouseEnter={() => setHover(i)}
							onMouseLeave={() => setHover(null)}
							onClick={() => b.dateKey && onBarClick?.(b.dateKey)}
							className={`${s.barGroup} ${b.dateKey ? s.clickable : ''}`}
						>
							<rect
								x={x - barGap / 2}
								y={PAD_T}
								width={barW}
								height={innerH}
								fill="transparent"
							/>
							{isEmpty ? (
								<rect
									x={x}
									y={baselineY - minDot}
									width={drawW}
									height={minDot}
									rx={1}
									fill={fill}
								/>
							) : (
								<rect
									x={x}
									y={y}
									width={drawW}
									height={Math.max(barH, minDot)}
									rx={2}
									fill={fill}
									opacity={hover === i ? 1 : 0.92}
								/>
							)}

							{metric === 'intensity' && b.count > 1 && (
								<g>
									<circle
										cx={x + drawW / 2}
										cy={y - 9}
										r={7.5}
										fill="rgba(28,31,40,0.95)"
										stroke="rgba(255,255,255,0.18)"
									/>
									<text
										x={x + drawW / 2}
										y={y - 6}
										className={s.badgeText}
										textAnchor="middle"
									>
										{b.count}
									</text>
								</g>
							)}
						</g>
					)
				})}

				{/* baseline */}
				<line
					x1={PAD_L}
					x2={w - PAD_R}
					y1={PAD_T + innerH}
					y2={PAD_T + innerH}
					className={s.baseline}
				/>

				{/* x labels */}
				{buckets.map((b, i) => {
					if (!labelIdx.has(i)) return null
					const x = PAD_L + barW * i + barW / 2
					return (
						<text
							key={`xl-${b.key}`}
							x={x}
							y={H - 8}
							className={s.xLabel}
							textAnchor="middle"
						>
							{b.label}
						</text>
					)
				})}
			</svg>

			{hover !== null && (
				<div
					className={s.tooltip}
					style={{ left: `${tooltipLeft}px`, transform: tooltipTransform }}
				>
					<div className={s.tooltipDate}>{formatTooltipDate(buckets[hover])}</div>
					<div className={s.tooltipRow}>
						<span className={s.tooltipLabel}>Приступов:</span>
						<span className={s.tooltipValue}>{buckets[hover].count}</span>
					</div>
					{buckets[hover].count > 0 && (
						<div className={s.tooltipRow}>
							<span className={s.tooltipLabel}>Макс. интенсивность:</span>
							<span
								className={s.tooltipValue}
								style={{ color: intensityColor(buckets[hover].maxIntensity) }}
							>
								{buckets[hover].maxIntensity}/10
							</span>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

export default BarChart
