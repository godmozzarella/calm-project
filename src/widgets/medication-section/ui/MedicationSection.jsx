import { AddIcon } from '@/shared/ui/icons'

import s from './MedicationSection.module.scss'

const MedicationSection = () => {
	return (
		<div className={s.card}>
			<div className={s.cardHeader}>
				<h2 className={s.title}>Препараты</h2>
				<button className={s.addBtn} aria-label="Добавить препарат">
					<AddIcon fontSize="small" />
					<span>Добавить</span>
				</button>
			</div>

			<div className={s.cardBody}>
				<div className={s.placeholder}>
					<p className={s.placeholderText}>Ничего не принято</p>
					<p className={s.placeholderHint}>Препараты и дозировки за день</p>
				</div>
			</div>
		</div>
	)
}

export default MedicationSection
