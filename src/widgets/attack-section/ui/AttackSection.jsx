import { AddIcon } from '@/shared/ui/icons'

import s from './AttackSection.module.scss'

const AttackSection = () => {
	return (
		<div className={s.card}>
			<div className={s.cardHeader}>
				<h2 className={s.title}>Приступы</h2>
				<button className={s.addBtn} aria-label="Добавить приступ">
					<AddIcon fontSize="small" />
					<span>Добавить</span>
				</button>
			</div>

			<div className={s.cardBody}>
				<div className={s.placeholder}>
					<p className={s.placeholderText}>Приступов за день нет</p>
					<p className={s.placeholderHint}>Интенсивность, симптомы, триггеры — всё будет здесь</p>
				</div>
			</div>
		</div>
	)
}

export default AttackSection
