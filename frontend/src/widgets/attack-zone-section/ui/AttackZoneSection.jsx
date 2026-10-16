import { useState, useEffect } from 'react'
import { formatAttackTime, PAIN_ZONE_LABELS, sortAttacksNewest, toZoneMap } from '@/entities/attack'
import { attackApi } from '@/shared/api'
import { EditIcon } from '@/shared/ui/icons'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'
import HeadFront from './HeadFront'
import HeadBack  from './HeadBack'
import { subscribe, ATTACKS_CHANGED } from '@/shared/lib/dataEvents'
import s from './AttackZoneSection.module.scss'

// green → yellow → red → remove
const CYCLE = { green: 'yellow', yellow: 'red', red: null }

const cycleZone = (zones, zone) => {
	const current = zones[zone] ?? null
	const next = current === null ? 'green' : CYCLE[current]
	if (next === null) {
		const { [zone]: _, ...rest } = zones
		return rest
	}
	return { ...zones, [zone]: next }
}

const fmtAttack = a =>
	`${a.startDate} ${formatAttackTime(a.startTime)}${a.ongoing ? ' — продолжается' : a.endTime ? ` — ${formatAttackTime(a.endTime)}` : ''} · ${a.intensity}/10`

const AttackZoneSection = ({ date }) => {
	const [attacks,    setAttacks]    = useState([])
	const [selectedId, setSelectedId] = useState(null)   // null = без привязки
	const [zones,      setZones]      = useState({})     // { zone: 'green'|'yellow'|'red' }
	const [editing, setEditing] = useState(false)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')

	// При смене дня сначала показываем текущий приступ, затем самые свежие.
	useEffect(() => {
		attackApi.getByDate(date).then(list => {
			const sorted = sortAttacksNewest(list)
			setAttacks(sorted)
			setSelectedId(sorted[0]?.id ?? null)
			setZones(toZoneMap(sorted[0]?.painZones))
			setEditing(false)
		})
	}, [date])

	// Эффект 1b: при внешнем добавлении/удалении приступа — перечитать список
	useEffect(() => subscribe(ATTACKS_CHANGED, () => {
		attackApi.getByDate(date).then(list => {
			const sorted = sortAttacksNewest(list)
			setAttacks(sorted)
			const selected = sorted.find(a => a.id === selectedId) ?? sorted[0]
			setSelectedId(selected?.id ?? null)
			setZones(toZoneMap(selected?.painZones))
			if (!selected || selected.id !== selectedId) setEditing(false)
		})
	}), [date, selectedId])

	const selectAttack = id => {
		if (id === selectedId) return
		setSelectedId(id)
		setZones(toZoneMap(attacks.find(a => a.id === id)?.painZones))
		setEditing(false)
		setError('')
	}

	const saveZones = async () => {
		const attack = attacks.find(a => a.id === selectedId)
		if (!attack || saving) return
		setSaving(true)
		setError('')
		try {
			await attackApi.update(selectedId, { ...attack, painZones: zones })
			setEditing(false)
		} catch (e) {
			setError(e.message || 'Не удалось сохранить зоны боли.')
		} finally { setSaving(false) }
	}

	// Зоны боли привязаны к приступам — без приступа отмечать нечего.
	const hasAttacks = attacks.length > 0

	const toggleZone = zone => {
		if (!hasAttacks || !editing) return
		const next = cycleZone(zones, zone)
		setZones(next)
	}

	const removeZone = (e, zone) => {
		e.stopPropagation()
		if (!hasAttacks || !editing) return
		const { [zone]: _, ...next } = zones
		setZones(next)
	}

	const clearAll = () => {
		if (!hasAttacks || !editing) return
		setZones({})
	}

	const zoneCount = Object.keys(zones).length

	return (
		<div className={s.card}>
			<div className={s.cardHeader}>
				<h2 className={s.title}>Зоны боли</h2>
				{editing && zoneCount > 0 && (
					<button className={s.clearBtn} onClick={clearAll}>Сбросить</button>
				)}
				{hasAttacks && !editing && <button className={s.editBtn} onClick={() => setEditing(true)} aria-label="Редактировать зоны боли"><EditIcon fontSize="small" /></button>}
				{editing && <div className={s.editActions}>
					<button onClick={() => { setZones(toZoneMap(attacks.find(a => a.id === selectedId)?.painZones)); setEditing(false); setError('') }} disabled={saving}>Отмена</button>
					<button onClick={saveZones} disabled={saving}>{saving ? 'Сохраняем…' : 'Готово'}</button>
				</div>}
			</div>

			<div className={`${s.cardBody} ${!hasAttacks ? s.cardBodyDisabled : ''}`}>
				{!hasAttacks && (
					<p className={s.emptyHint}>
						Сначала добавьте приступ за этот день — тогда можно будет отметить зоны боли.
					</p>
				)}
				{/* Attack selector */}
				{attacks.length > 0 && (
					<div className={s.attackSelector}>
						<span className={s.selectorLabel}>Приступ</span>
						<div className={s.attackPills}>
							{attacks.map(a => (
								<button
									key={a.id}
					aria-pressed={selectedId === a.id}
									className={`${s.attackPill} ${selectedId === a.id ? s.attackPillActive : ''}`}
									onClick={() => selectAttack(a.id)}
								>
									{fmtAttack(a)}
								</button>
							))}
						</div>
					</div>
				)}

				{/* Head visualizations */}
				<ErrorNotice message={error} title="Не удалось сохранить зоны боли" />
				<div className={`${s.headsRow} ${!hasAttacks ? s.headsRowMuted : ''}`} aria-disabled={!hasAttacks}>
					<div className={s.headView}>
						<HeadFront zones={zones} onToggle={toggleZone} readOnly={!editing} />
						<span className={s.headLabel}>Спереди</span>
					</div>
					<div className={s.dividerV} />
					<div className={s.headView}>
						<HeadBack zones={zones} onToggle={toggleZone} readOnly={!editing} />
						<span className={s.headLabel}>Сзади</span>
					</div>
				</div>

				{/* Zone tags + hint */}
				{zoneCount > 0 ? (
					<>
						<div className={s.zoneTags}>
							{Object.entries(zones).map(([zone, color]) => (
								<button
									key={zone}
									className={`${s.zoneTag} ${s[`zoneTag_${color}`]}`}
									onClick={() => toggleZone(zone)}
									disabled={!editing}
									title={editing ? 'Изменить интенсивность' : PAIN_ZONE_LABELS[zone]}
								>
									<span className={`${s.zoneDot} ${s[`dot_${color}`]}`} />
									{PAIN_ZONE_LABELS[zone]}
									{editing && <span className={s.zoneTagX} onClick={e => removeZone(e, zone)}>✕</span>}
								</button>
							))}
						</div>
						{editing && <p className={s.intensityHint}>Нажмите зону, чтобы изменить интенсивность</p>}
					</>
				) : (
					<>
						<p className={s.hint}>{editing ? 'Нажмите на область, чтобы отметить зону боли' : 'Нажмите карандаш, чтобы отметить зоны боли'}</p>
						<div className={s.legend}>
							<span className={`${s.legendDot} ${s.dot_green}`}  /> Слабая
							<span className={`${s.legendDot} ${s.dot_yellow}`} /> Умеренная
							<span className={`${s.legendDot} ${s.dot_red}`}    /> Сильная
						</div>
					</>
				)}
			</div>
		</div>
	)
}

export default AttackZoneSection
