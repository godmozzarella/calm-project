import Button from '../Button/Button'
import { AddIcon } from '../../assets/icons'

import s from './AttackSection.module.scss'

const AttackSection = () =>{
	return(
		<section className={s.item}>
			<h2>Приступы</h2>
			<Button
				className={s.add}
				icon={<AddIcon />}
			/>
		</section>
	)
}

export default AttackSection