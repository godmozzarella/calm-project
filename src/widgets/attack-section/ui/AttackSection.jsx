import { Button } from '@/shared/ui/Button'
import { AddIcon } from '@/shared/ui/icons'

import s from './AttackSection.module.scss'

const AttackSection = () => {
	return (
		<section className={s.item}>
			<h2>Приступы</h2>
			<Button className={s.add} icon={<AddIcon />} />
		</section>
	)
}

export default AttackSection
