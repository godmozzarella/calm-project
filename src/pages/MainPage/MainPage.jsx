import Footer from '../../components/Footer/Footer'
import s from './MainPage.module.scss'

import { Link } from 'react-router-dom'
import { CalendarMonthIcon, MenuIcon } from '../../assets/icons'

const MainPage = () => {
	return (
		<div className={s.mainPage}>
			<>
				<span className={`${s.icon} ${s.menu}`}>
					<MenuIcon />
				</span>
				<span className={`${s.icon} ${s.calendar}`}>
					<CalendarMonthIcon />
				</span>
			</>
			<main>
				<Link to={'/'}>
					<h1 className={s.logo}>Calm</h1>
				</Link>
				<div className={s.dayBar}>Понедельник, 4 февраля</div>
				<section>
					<div className={`${s.parametersContent} ${s.flexItem}`}>
						{/* приступы */}
						<div className={s.item}>
							<h2>Приступы</h2>
							<button className={s.add}>+</button>
						</div>

						{/* принятые препараты */}
						<div className={s.item}>
							<h2>Принятые препараты</h2>
							<button className={s.add}>+</button>
						</div>

						{/* зоны головной боли */}
						<div className={s.item}>
							<h2>Зоны головной боли</h2>
							<div className={s.headachesChart}>
								<div className={s.front}></div>
								<div className={s.back}></div>
							</div>
						</div>
					</div>
					<div className={`${s.chartContent} ${s.flexItem}`}>
						<h2>График</h2>
						<div className={s.chart}></div>
						<p className={s.chartDescription}></p>
					</div>
				</section>
			</main>

			<Footer />
		</div>
	)
}

export default MainPage
