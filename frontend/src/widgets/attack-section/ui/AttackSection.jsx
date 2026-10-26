import { useState, useCallback, useEffect } from 'react'

import { AddIcon, DeleteIcon, EditIcon } from '@/shared/ui/icons'
import { AddAttackForm, useAddAttack } from '@/features/add-attack'
import { formatAttackTime, getAttackTypeLabel, intensityColor, sortAttacksNewest } from '@/entities/attack'
import { attackApi } from '@/shared/api'
import { subscribe, ATTACKS_CHANGED, OPEN_ATTACK_FORM } from '@/shared/lib/dataEvents'
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

	const startTime = formatAttackTime(attack.startTime)
	const endTime = formatAttackTime(attack.endTime)

	if (attack.ongoing) {
		return `${shortDate(startDate)}, ${startTime} — продолжается`
	}
	if (!endTime) {
		return `${shortDate(startDate)}, ${startTime}`
	}
	if (sameDay) {
		return `${shortDate(startDate)}, ${startTime} — ${endTime}`
	}
	return `${shortDate(startDate)} ${startTime} — ${shortDate(endDate)} ${endTime}`
}

const AttackSection = ({ date, onInitialReady }) => {
	const [attacks, setAttacks] = useState([])
	const { getLabel } = useDictionaries()

	const reload = useCallback(
		() => attackApi.getByDate(date).then(list => setAttacks(sortAttacksNewest(list))),
		[date]
	)

	useEffect(() => {
		let active = true
		reload().catch(() => {}).finally(() => { if (active) onInitialReady?.('attacks') })
		return () => { active = false }
	}, [reload, onInitialReady])

	useEffect(() => subscribe(ATTACKS_CHANGED, reload), [reload])

	const { open, form, error, loading, editingId, openForm, openEditForm, closeForm, setField, toggleArrayField, submit } =
		useAddAttack({ date, onSuccess: reload })
	useEffect(() => subscribe(OPEN_ATTACK_FORM, openForm), [openForm])

	const handleDelete = id => attackApi.delete(id)
	const handleCardClick = event => {
		if (!event.target.closest('button, a, input, select, textarea')) openForm()
	}

	return (
		<>
			<div className={s.card} onClick={handleCardClick} data-help="Приступы: здесь можно записать новый приступ, а также посмотреть и изменить уже добавленные.">
				<div className={s.cardHeader}>
					<h2 className={s.title}>Приступы</h2>
					<button className={s.addBtn} onClick={openForm} aria-label="Добавить приступ" data-help="Добавить приступ за выбранный день: укажите время, силу боли, симптомы и другие подробности.">
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
												{getAttackTypeLabel(attack.type)}
											</span>
										</div>
										<div className={s.attackRight}>
											<span
												className={s.intensityBadge}
												style={{ color: intensityColor(attack.intensity) }}
											>
												{attack.intensity}/10
											</span>
											<button
												className={s.editBtn}
												onClick={() => openEditForm(attack)}
												aria-label="Редактировать приступ"
								data-help="Изменить время и подробности этого приступа."
											>
												<EditIcon style={{ fontSize: '1rem' }} />
											</button>
											<button
												className={s.deleteBtn}
												onClick={() => handleDelete(attack.id)}
												aria-label="Удалить"
								data-help="Удалить эту запись о приступе."
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
				loading={loading}
				editing={!!editingId}
				onClose={closeForm}
				setField={setField}
				toggleArrayField={toggleArrayField}
				onSubmit={submit}
			/>
		</>
	)
}

export default AttackSection
