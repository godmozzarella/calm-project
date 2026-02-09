
import { Link } from 'react-router-dom'
import s from './MainSection.module.scss'
import AttackSection from '../AttackSection/AttackSection'
import MedicationSection from '../MedicationSection/MedicationSection'
import AttackZoneSection from '../AttackZoneSection/AttackZoneSection'
import ChartSection from '../ChartSection/ChartSection'
import DayBar from '../DayBar/DayBar'

const MainSection = () => {
    return (
        <main>
            <Link to={'/'}>
							<h1 className={s.logo}>Calm</h1>
						</Link>

						<DayBar />

						<section>
							<div className={`${s.parametersContent} ${s.flexItem}`}>

								{/* приступы */}
								<AttackSection />

								{/* принятые препараты */}
								<MedicationSection />

								{/* зоны головной боли */}
								<AttackZoneSection />							
							</div>

							{/* график */}
							<ChartSection />
						</section>
        </main>
    )
}

export default MainSection