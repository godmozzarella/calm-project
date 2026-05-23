import { useState, useEffect, useMemo, useCallback } from 'react'

import { getAllAttacks } from '@/entities/attack'
import { subscribe, emit, ATTACKS_CHANGED, DATE_SELECTED } from '@/shared/lib/dataEvents'

import BarChart from './BarChart'
import { buildBuckets, PERIOD_OPTIONS, METRIC_OPTIONS } from '../lib/buckets'

import s from './ChartSection.module.scss'

const ChartSection = () => {
	const [period, setPeriod] = useState('month')
	const [metric, setMetric] = useState('intensity')
	const [attacks, setAttacks] = useState(() => getAllAttacks())

	const reload = useCallback(() => setAttacks(getAllAttacks()), [])

	useEffect(() => subscribe(ATTACKS_CHANGED, reload), [reload])

	const buckets = useMemo(
		() => buildBuckets(period, attacks),
		[period, attacks]
	)

	const handleBarClick = dateKey => {
		if (!dateKey) return
		emit(DATE_SELECTED, dateKey)
	}

	return (
		<div className={s.card}>
			<div className={s.cardHeader}>
				<h2 className={s.title}>График</h2>
				<div className={s.controls}>
					<div className={s.tabs} role="tablist" aria-label="Метрика">
						{METRIC_OPTIONS.map(o => (
							<button
								key={o.value}
								className={`${s.tab} ${metric === o.value ? s.tabActive : ''}`}
								onClick={() => setMetric(o.value)}
								role="tab"
								aria-selected={metric === o.value}
							>
								{o.label}
							</button>
						))}
					</div>
					<div className={s.tabs} role="tablist" aria-label="Период">
						{PERIOD_OPTIONS.map(o => (
							<button
								key={o.value}
								className={`${s.tab} ${period === o.value ? s.tabActive : ''}`}
								onClick={() => setPeriod(o.value)}
								role="tab"
								aria-selected={period === o.value}
							>
								{o.label}
							</button>
						))}
					</div>
				</div>
			</div>

			<div className={s.cardBody}>
				<BarChart
					buckets={buckets}
					metric={metric}
					onBarClick={handleBarClick}
				/>
				{attacks.length === 0 && (
					<p className={s.hint}>
						Когда вы добавите первый приступ, он появится на графике
					</p>
				)}
			</div>
		</div>
	)
}

export default ChartSection
