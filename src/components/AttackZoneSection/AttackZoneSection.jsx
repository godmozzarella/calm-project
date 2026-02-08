

import s from './AttackZoneSection.module.scss'

const AttackZoneSection = () =>{
	return(
		<section className={s.item}>
				<h2>Зоны головной боли</h2>
				<div className={s.headachesChart}>
					<div className={s.front}></div>
					<div className={s.back}></div>
				</div>
		</section>
	)
}

export default AttackZoneSection