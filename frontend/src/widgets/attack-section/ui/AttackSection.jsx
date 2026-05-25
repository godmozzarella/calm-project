import { useState, useCallback, useEffect } from 'react'

import { AddIcon, DeleteIcon } from '@/shared/ui/icons'
import { AddAttackForm, useAddAttack } from '@/features/add-attack'
import { ATTACK_TYPE_LABELS, intensityColor } from '@/entities/attack'
import { attackApi } from '@/shared/api'
import { subscribe, ATTACKS_CHANGED } from '@/shared/lib/dataEvents'
import { useDictionaries } from '@/shared/lib/dictionaries'

import s from './AttackSection.module.scss'

const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

const shortDate = iso => {
	const [, m, d] = iso.split('-')
	return `${Number(d)} ${MONTH_SHORT[Number(m) - 1]}`
}

const formatRange = attack => {
	const startDate = attack.startDate ?? attack.date
	const endDate = attack.endDate ?? startDate
	const sameDay = startDate === endDate

	const startTime = attack.startTime
	const endTime = attack.endTime

	if (attack.ongoing) {
		return sameDay
			? `${startTime} — сейчас`
			: `${shortDate(startDate)}, ${startTime} — сейчас`
	}
	if (!endTime) {
		return `${shortDate(startDate)}, ${startTime}`
	}
	if (sameDay) {
		return `${shortDate(startDate)}, ${startTime} — ${endTime}`
	}
	return `${shortDate(startDate)} ${startTime} — ${shortDate(endDate)} ${endTime}`
}

const AttackSection = ({ date }) => {
	const [attacks, setAttacks] = useState([])
	const { getLabel } = useDictionaries()

	const reload = useCallback(
		() => attackApi.getByDate(date).then(setAttacks),
		[date]
	)

	useEffect(() => { reload() }, [reload])

	useEffect(() => subscribe(ATTACKS_CHANGED, reload), [reload])

	const { open, form, error, loading, openForm, closeForm, setField, toggleArrayField, submit } =
		useAddAttack({ date, onSuccess: reload })

	const handleDelete = id => attackApi.delete(id)

	return (
		<>
			<div className={s.card}>
				<div className={s.cardHeader}>
					<h2 className={s.title}>Приступы</h2>
					<button className={s.addBtn} onClick={openForm} aria-label="Добавить приступ">
						<AddIcon fontSize="small" />
						<span>Добавить</span>
					</button>
				</div>

				<div className={s.cardBody}>
					{attacks.length === 0 ? (
						<div className={s.empty}>
							<p className={s.emptyText}>Приступов за день нет</p>
							<p className={s.emptyHint}>Интенсивность, симптомы, триггеры — всё будет здесь</p>
						</div>
					) : (
						<ul className={s.list}>
							{attacks.map(attack => (
								<li key={attack.id} className={s.attackCard}>
									<div className={s.attackTop}>
										<div className={s.attackMeta}>
											<span className={s.attackTime}>
												{formatRange(attack)}
											</span>
											<span className={s.attackType}>
												{ATTACK_TYPE_LABELS[attack.type]}
											</span>
										</div>
										<div className={s.attackRight}>
											<span
												className={s.intensityBadge}
												style={{ background: `${intensityColor(attack.intensity)}22`, color: intensityColor(attack.intensity), borderColor: `${intensityColor(attack.intensity)}55` }}
											>
												{attack.intensity}/10
											</span>
											<button
												className={s.deleteBtn}
												onClick={() => handleDelete(attack.id)}
												aria-label="Удалить"
											>
												<DeleteIcon style={{ fontSize: '1rem' }} />
											</button>
										</div>
									</div>

									{attack.symptoms.length > 0 && (
										<div className={s.chips}>
											{attack.symptoms.map(sym => (
												<span key={sym} className={s.chip}>
													{getLabel('SYMPTOM', sym)}
												</span>
											))}
										</div>
									)}

									{attack.note && (
										<p className={s.note}>{attack.note}</p>
									)}
								</li>
							))}
						</ul>
					)}
				</div>
			</div>

			<AddAttackForm
				open={open}
				form={form}
				error={error}
				onClose={closeForm}
				setField={setField}
				toggleArrayField={toggleArrayField}
				onSubmit={submit}
			/>
		</>
	)
}

export default AttackSection
