import { useState, useEffect, useMemo, useCallback } from 'react'

import { getAllAttacks } from '@/entities/attack'
import { getAllMedications } from '@/entities/medication'
import {
	subscribe,
	emit,
	ATTACKS_CHANGED,
	MEDICATIONS_CHANGED,
	DATE_SELECTED,
} from '@/shared/lib/dataEvents'

import BarChart from './BarChart'
import KpiTiles from './KpiTiles'
import PatternsBlock from './PatternsBlock'
import { buildBuckets, PERIOD_OPTIONS, METRIC_OPTIONS } from '../lib/buckets'
import { computeKpis, computePatterns } from '../lib/aggregates'

import s from './ChartSection.module.scss'

const ChartSection = () => {
	const [period, setPeriod] = useState('month')
	const [metric, setMetric] = useState('intensity')
	const [attacks, setAttacks] = useState(() => getAllAttacks())
	const [medications, setMedications] = useState(() => getAllMedications())

	const reloadAttacks = useCallback(() => setAttacks(getAllAttacks()), [])
	const reloadMeds = useCallback(() => setMedications(getAllMedications()), [])

	useEffect(() => subscribe(ATTACKS_CHANGED, reloadAttacks), [reloadAttacks])
	useEffect(() => subscribe(MEDICATIONS_CHANGED, reloadMeds), [reloadMeds])

	const buckets = useMemo(
		() => buildBuckets(period, attacks),
		[period, attacks]
	)

	const kpis = useMemo(
		() => computeKpis(attacks, buckets),
		// medications в deps — нужен пересчёт overuseDays при добавлении/удалении препарата
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[attacks, buckets, medications]
	)

	const patterns = useMemo(
		() => computePatterns(attacks, medications, buckets),
		[attacks, medications, buckets]
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
				<KpiTiles kpis={kpis} />

				<BarChart
					buckets={buckets}
					metric={metric}
					onBarClick={handleBarClick}
				/>

				{attacks.length === 0 ? (
					<p className={s.hint}>
						Когда вы добавите первый приступ, он появится на графике
					</p>
				) : (
					<PatternsBlock patterns={patterns} />
				)}
			</div>
		</div>
	)
}

export default ChartSection
