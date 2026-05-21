import { Link } from 'react-router-dom'

import { AttackSection } from '@/widgets/attack-section'
import { MedicationSection } from '@/widgets/medication-section'
import { AttackZoneSection } from '@/widgets/attack-zone-section'
import { ChartSection } from '@/widgets/chart-section'
import { DayBar } from '@/widgets/day-bar'

import s from './MainSection.module.scss'

const MainSection = () => {
	return (
		<main>
			<Link to="/">
				<h1 className={s.logo}>Calm</h1>
			</Link>

			<DayBar />

			<section>
				<div className={`${s.parametersContent} ${s.flexItem}`}>
					<AttackSection />
					<MedicationSection />
					<AttackZoneSection />
				</div>

				<ChartSection />
			</section>
		</main>
	)
}

export default MainSection
