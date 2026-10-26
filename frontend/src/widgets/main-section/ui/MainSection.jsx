import { useEffect } from 'react'

import { AttackSection } from '@/widgets/attack-section'
import { MedicationSection } from '@/widgets/medication-section'
import { AttackZoneSection } from '@/widgets/attack-zone-section'
import { ChartSection } from '@/widgets/chart-section'
import { ForecastSection } from '@/widgets/forecast-section'
import { DayBar, midnight, dateKey } from '@/widgets/day-bar'
import { DailyOutcome } from '@/widgets/daily-outcome'
import { subscribe, DATE_SELECTED } from '@/shared/lib/dataEvents'

import s from './MainSection.module.scss'

const MainSection = ({ user, date, setDate, onOpenLocationModal, onInitialReady }) => {
	useEffect(() => subscribe(DATE_SELECTED, e => {
		const key = e.detail
		if (typeof key !== 'string') return
		const [y, m, d] = key.split('-').map(Number)
		if (!y || !m || !d) return
		const requested = midnight(new Date(y, m - 1, d))
		if (requested > midnight()) return
		setDate(requested)
		window.scrollTo({ top: 0, behavior: 'smooth' })
	}), [setDate])

	return (
		<main className={s.main}>
			<h1 className={s.logo}>Calm</h1>

			<DayBar date={date} setDate={setDate} city={user?.city} userId={user?.id} />
			<DailyOutcome key={dateKey(date)} date={dateKey(date)} isToday={dateKey(date) === dateKey(midnight())} onInitialReady={onInitialReady} />

			<div className={s.grid}>
				<div className={s.topRow}>
					<AttackSection date={dateKey(date)} onInitialReady={onInitialReady} />
					<MedicationSection date={dateKey(date)} onInitialReady={onInitialReady} />
					<AttackZoneSection date={dateKey(date)} onInitialReady={onInitialReady} />
				</div>

				<div className={s.forecastRow}>
					<ForecastSection user={user} onOpenLocationModal={onOpenLocationModal} onInitialReady={onInitialReady} />
				</div>

				<div id="diary-chart" className={s.bottomRow}>
					<ChartSection showPatterns={false} statsLink onInitialReady={onInitialReady} />
				</div>
			</div>
		</main>
	)
}

export default MainSection
