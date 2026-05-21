import { AddIcon } from '../../assets/icons'
import Button from '../../shared/Button/Button'
import s from './MedicationSection.module.scss'

const MedicationSection = () => {
	return (
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
