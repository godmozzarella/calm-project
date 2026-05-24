import { intensityColor } from '@/entities/attack'
import { OVERUSE_THRESHOLD } from '@/entities/medication'
import s from './KpiTiles.module.scss'

const pluralAttacks = n => {
	const mod10 = n % 10
	const mod100 = n % 100
	if (mod10 === 1 && mod100 !== 11) return 'приступ'
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'приступа'
	return 'приступов'
}

const pluralDays = n => {
	const mod10 = n % 10
	const mod100 = n % 100
	if (mod10 === 1 && mod100 !== 11) return 'день'
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня'
	return 'дней'
}

const KpiTiles = ({ kpis }) => {
	const { total, avgIntensity, streak, overuseDays, overuseRisk } = kpis

	const intensityFmt = avgIntensity > 0 ? avgIntensity.toFixed(1) : '—'
	const intensityColr = avgIntensity > 0 ? intensityColor(Math.round(avgIntensity)) : null

	return (
		<div className={s.grid}>
			<div className={s.tile}>
				<span className={s.label}>Всего</span>
				<span className={s.value}>{total}</span>
				<span className={s.sub}>{pluralAttacks(total)} за период</span>
			</div>

			<div className={s.tile}>
				<span className={s.label}>Средняя интенсивность</span>
				<span
					className={s.value}
					style={intensityColr ? { color: intensityColr } : undefined}
				>
					{intensityFmt}
				</span>
				<span className={s.sub}>{avgIntensity > 0 ? 'из 10' : 'нет данных'}</span>
			</div>

			<div className={s.tile}>
				<span className={s.label}>Серия без боли</span>
				<span className={s.value}>{streak}</span>
				<span className={s.sub}>{pluralDays(streak)} подряд</span>
			</div>

			<div className={`${s.tile} ${overuseRisk ? s.tileWarn : ''}`}>
				<span className={s.label}>Обезболивающие</span>
				<span className={s.value}>{overuseDays}</span>
				<span className={s.sub}>
					{overuseRisk
						? `риск абузуса (${OVERUSE_THRESHOLD}+ ${pluralDays(OVERUSE_THRESHOLD)}/мес)`
						: `${pluralDays(overuseDays)} в этом месяце`}
				</span>
			</div>
		</div>
	)
}

export default KpiTiles
