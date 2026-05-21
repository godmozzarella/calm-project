import { Button } from '@/shared/ui/Button'
import { AddIcon } from '@/shared/ui/icons'

import s from './MedicationSection.module.scss'

const MedicationSection = () => {
	return (
		<section className={s.item}>
			<h2>Принятые препараты</h2>
			<Button className={s.add} icon={<AddIcon />} />
		</section>
	)
}

export default MedicationSection
