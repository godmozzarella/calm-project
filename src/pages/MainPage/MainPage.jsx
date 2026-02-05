import Footer from '../../components/Footer/Footer'

import { Link } from 'react-router-dom'
import { CalendarMonthIcon, MenuIcon } from '../../assets/icons'
import { useState } from 'react'

import s from './MainPage.module.scss'

const MainPage = () => {

	const [open, setOpen] = useState(false)

	return (
		<div className={s.mainPage}>
			<>
				<button className={`${s.icon} ${s.menu}`} onClick={() => setOpen(!open)}>
					<MenuIcon />
				</button>

				{/* боковое меню */}
				<div className={`${s.sidebar} ${open ? s.active : ""}`}>
					<h1 onClick={() => setOpen(false)} className={s.logo}>Calm</h1>
					<div className={s.list}>
						<a href="#">Профиль</a>  {/* // TODO: заменить на Link 		*/}		
						<a href="#">Настройки</a>   {/*// TODO: заменить на всплывающее окно настроек */}	
					</div>
						
				</div>

      {open && <div className={s.overlay} onClick={() => setOpen(false)} />}

				<button className={`${s.icon} ${s.calendar}`}>
					<CalendarMonthIcon />
				</button>
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
