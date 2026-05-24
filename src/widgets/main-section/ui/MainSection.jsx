import { Link } from 'react-router-dom'

import { AttackSection } from '@/widgets/attack-section'
import { MedicationSection } from '@/widgets/medication-section'
import { AttackZoneSection } from '@/widgets/attack-zone-section'
import { ChartSection } from '@/widgets/chart-section'
import { DayBar } from '@/widgets/day-bar'

import s from './MainSection.module.scss'

const MainSection = () => {
	return (
		<main className={s.main}>
			<Link to="/">
				<h1 className={s.logo}>Calm</h1>
			</Link>

			<DayBar />

			<div className={s.grid}>
				<div className={s.topRow}>
					<AttackSection />
					<MedicationSection />
					<AttackZoneSection />
				</div>

				<div className={s.bottomRow}>
					<ChartSection />
				</div>
			</div>
		</main>
	)
}

export default MainSection
