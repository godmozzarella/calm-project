
import s from './MedicationSection.module.scss'
import Button from '../Button/Button'
import { AddIcon } from '../../assets/icons'



const MedicationSection = () => {
	return(
		<section className={s.item}>
				<h2>Принятые препараты</h2>
				<Button
					className={s.add}
					icon={<AddIcon />}
				/>
		</section>
	)
}

export default MedicationSection