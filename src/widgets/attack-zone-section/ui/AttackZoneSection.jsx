import { useState, useEffect } from 'react'
import {
	PAIN_ZONE_LABELS,
	getAttacksByDate,
	updateAttack,
	getZonesByDate,
	setZonesByDate,
	toZoneMap,
} from '@/entities/attack'
import HeadFront from './HeadFront'
import HeadBack  from './HeadBack'
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
	`${a.startTime}${a.ongoing ? ' — сейчас' : a.endTime ? ` — ${a.endTime}` : ''} · ${a.intensity}/10`

const AttackZoneSection = ({ date }) => {
	const [attacks,    setAttacks]    = useState([])
	const [selectedId, setSelectedId] = useState(null)   // null = без привязки
	const [zones,      setZones]      = useState({})     // { zone: 'green'|'yellow'|'red' }

	// Эффект 1: смена даты — перезагрузить приступы, сбросить выбор
	useEffect(() => {
		setAttacks(getAttacksByDate(date))
		setSelectedId(null)
	}, [date])

	// Эффект 2: смена выбранного приступа — загрузить зоны из него или из calm_zones
	useEffect(() => {
		if (selectedId === null) {
			setZones(getZonesByDate(date))
		} else {
			setAttacks(current => {
				const attack = current.find(a => a.id === selectedId)
				if (attack) {
					setZones(toZoneMap(attack.painZones))
				} else {
					// приступ удалён — откат к без привязки
					setSelectedId(null)
					setZones(getZonesByDate(date))
				}
				return current
			})
		}
	// date здесь нужна только при selectedId===null; attacks намеренно вне deps
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedId])

	const selectAttack = id => {
		if (id === selectedId) return
		setSelectedId(id)
		if (id === null) {
			setZones(getZonesByDate(date))
		} else {
			const attack = attacks.find(a => a.id === id)
			setZones(toZoneMap(attack?.painZones))
		}
	}

	const saveZones = (next, attackId) => {
		if (attackId) {
			updateAttack(attackId, { painZones: next })
			// синхронизировать кеш приступов чтобы эффект 2 не перезатёр зоны
			setAttacks(prev => prev.map(a => a.id === attackId ? { ...a, painZones: next } : a))
		} else {
			setZonesByDate(date, next)
		}
	}

	const toggleZone = zone => {
		const next = cycleZone(zones, zone)
		setZones(next)
		saveZones(next, selectedId)
	}

	const removeZone = (e, zone) => {
		e.stopPropagation()
		const { [zone]: _, ...next } = zones
		setZones(next)
		saveZones(next, selectedId)
	}

	const clearAll = () => {
		setZones({})
		saveZones({}, selectedId)
	}

	const zoneCount = Object.keys(zones).length

	return (
		<div className={s.card}>
			<div className={s.cardHeader}>
				<h2 className={s.title}>Зоны боли</h2>
				{zoneCount > 0 && (
					<button className={s.clearBtn} onClick={clearAll}>Сбросить</button>
				)}
			</div>

			<div className={s.cardBody}>
				{/* Attack selector */}
				{attacks.length > 0 && (
					<div className={s.attackSelector}>
						<span className={s.selectorLabel}>Приступ</span>
						<div className={s.attackPills}>
							<button
								className={`${s.attackPill} ${selectedId === null ? s.attackPillActive : ''}`}
								onClick={() => selectAttack(null)}
							>
								Без привязки
							</button>
							{attacks.map(a => (
								<button
									key={a.id}
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
				<div className={s.headsRow}>
					<div className={s.headView}>
						<HeadFront zones={zones} onToggle={toggleZone} />
						<span className={s.headLabel}>Спереди</span>
					</div>
					<div className={s.dividerV} />
					<div className={s.headView}>
						<HeadBack zones={zones} onToggle={toggleZone} />
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
									title="Нажмите чтобы изменить интенсивность"
								>
									<span className={`${s.zoneDot} ${s[`dot_${color}`]}`} />
									{PAIN_ZONE_LABELS[zone]}
									<span className={s.zoneTagX} onClick={e => removeZone(e, zone)}>✕</span>
								</button>
							))}
						</div>
						<p className={s.intensityHint}>Нажмите зону чтобы изменить интенсивность</p>
					</>
				) : (
					<>
						<p className={s.hint}>Нажмите на область чтобы отметить зону боли</p>
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
