import { useState, useEffect } from 'react'

import { AttackSection } from '@/widgets/attack-section'
import { MedicationSection } from '@/widgets/medication-section'
import { AttackZoneSection } from '@/widgets/attack-zone-section'
import { ChartSection } from '@/widgets/chart-section'
import { ForecastSection } from '@/widgets/forecast-section'
import { DayBar, midnight, dateKey } from '@/widgets/day-bar'
import { subscribe, DATE_SELECTED } from '@/shared/lib/dataEvents'

import s from './MainSection.module.scss'

const MainSection = ({ user }) => {
	const [date, setDate] = useState(midnight())

	useEffect(() => subscribe(DATE_SELECTED, e => {
		const key = e.detail
		if (typeof key !== 'string') return
		const [y, m, d] = key.split('-').map(Number)
		if (!y || !m || !d) return
		setDate(midnight(new Date(y, m - 1, d)))
		window.scrollTo({ top: 0, behavior: 'smooth' })
	}), [])

	return (
		<main className={s.main}>
			<h1 className={s.logo}>Calm</h1>

			<DayBar date={date} setDate={setDate} city={user?.city} />

			<div className={s.grid}>
				<div className={s.topRow}>
					<AttackSection date={dateKey(date)} />
					<MedicationSection date={dateKey(date)} />
					<AttackZoneSection date={dateKey(date)} />
				</div>

				<div className={s.forecastRow}>
					<ForecastSection user={user} />
				</div>

				<div className={s.bottomRow}>
					<ChartSection showPatterns={false} statsLink />
				</div>
			</div>
		</main>
	)
}

export default MainSection
