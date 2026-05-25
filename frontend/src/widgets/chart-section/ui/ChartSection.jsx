import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'

import { OpenInNewIcon } from '@/shared/ui/icons'
import { statsApi } from '@/shared/api'
import {
	subscribe,
	emit,
	ATTACKS_CHANGED,
	MEDICATIONS_CHANGED,
} from '@/shared/lib/dataEvents'

import BarChart from './BarChart'
import KpiTiles from './KpiTiles'
import PatternsBlock from './PatternsBlock'
import WeatherCorrelationBlock from './WeatherCorrelationBlock'
import { PERIOD_OPTIONS, METRIC_OPTIONS } from '../lib/buckets'

import s from './ChartSection.module.scss'

const EMPTY_KPIS = { total: 0, avgIntensity: 0, longestStreak: 0, overuseDays: 0, overuseRisk: false }
const EMPTY_PATTERNS = { topTriggers: [], topSymptoms: [], zones: { freq: {}, colorMap: {}, max: 0 }, meds: [] }

const ChartSection = ({ showPatterns = true, statsLink = false }) => {
	const [period, setPeriod] = useState('month')
	const [metric, setMetric] = useState('intensity')
	const [buckets, setBuckets]   = useState([])
	const [kpis, setKpis]         = useState(EMPTY_KPIS)
	const [patterns, setPatterns] = useState(EMPTY_PATTERNS)
	const [weather, setWeather]   = useState(null)

	const load = useCallback(() => {
		statsApi.getSummary(period).then(data => {
			setBuckets(data.buckets ?? [])
			setKpis(data.kpis ?? EMPTY_KPIS)
			// server returns longestStreak, KpiTiles expects streak
			setKpis({ ...data.kpis, streak: data.kpis.longestStreak })
			setPatterns(data.patterns ?? EMPTY_PATTERNS)
			setWeather(data.weather ?? null)
		}).catch(() => {})
	}, [period])

	useEffect(() => { load() }, [load])
	useEffect(() => subscribe(ATTACKS_CHANGED,     load), [load])
	useEffect(() => subscribe(MEDICATIONS_CHANGED, load), [load])

	const handleBarClick = dateKey => {
		if (!dateKey) return
		emit('calm:date-selected', dateKey)
	}

	const hasData = buckets.some(b => b.count > 0)

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
					{statsLink && (
						<Link to="/stats" className={s.statsLink}>
							Подробная статистика
							<OpenInNewIcon style={{ fontSize: '0.875rem' }} />
						</Link>
					)}
				</div>
			</div>

			<div className={s.cardBody}>
				<KpiTiles kpis={kpis} />

				<BarChart
					buckets={buckets}
					metric={metric}
					onBarClick={handleBarClick}
				/>

				{!hasData ? (
					<p className={s.hint}>
						Когда вы добавите первый приступ, он появится на графике
					</p>
				) : showPatterns ? (
					<>
						<PatternsBlock patterns={patterns} />
						<WeatherCorrelationBlock weather={weather} />
					</>
				) : null}
			</div>
		</div>
	)
}

export default ChartSection
