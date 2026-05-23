import { EFFECTIVENESS_LABELS } from '@/entities/medication'
import HeadFront from '@/widgets/attack-zone-section/ui/HeadFront'
import HeadBack from '@/widgets/attack-zone-section/ui/HeadBack'
import s from './PatternsBlock.module.scss'

const EFF_COLOR = { 1: '#ef4444', 2: '#eab308', 3: '#22c55e' }

const formatShare = share => `${Math.round(share * 100)}%`

const BarRow = ({ label, count, share, accent }) => (
	<div className={s.barRow}>
		<span className={s.barLabel} title={label}>{label}</span>
		<div className={s.barTrack}>
			<div
				className={s.barFill}
				style={{ width: `${Math.max(share * 100, 4)}%`, background: accent }}
			/>
		</div>
		<span className={s.barCount}>{count}<span className={s.barShare}> · {formatShare(share)}</span></span>
	</div>
)

const ListBlock = ({ title, items, accent, emptyText }) => (
	<div className={s.block}>
		<h3 className={s.blockTitle}>{title}</h3>
		{items.length === 0 ? (
			<p className={s.empty}>{emptyText}</p>
		) : (
			<div className={s.list}>
				{items.map(it => (
					<BarRow
						key={it.key}
						label={it.label}
						count={it.count}
						share={it.share}
						accent={accent}
					/>
				))}
			</div>
		)}
	</div>
)

const MedsBlock = ({ items }) => (
	<div className={s.block}>
		<h3 className={s.blockTitle}>Эффективность препаратов</h3>
		{items.length === 0 ? (
			<p className={s.empty}>За период препараты не принимались</p>
		) : (
			<ul className={s.medList}>
				{items.map(m => {
					const rounded = m.avgEff !== null ? Math.round(m.avgEff) : null
					const color = rounded ? EFF_COLOR[rounded] : 'rgba(140,150,170,0.4)'
					const label = rounded
						? `${EFFECTIVENESS_LABELS[rounded]} · ${m.avgEff.toFixed(1)}/3`
						: 'Не оценено'
					return (
						<li key={m.name} className={s.medItem}>
							<div className={s.medMeta}>
								<span className={s.medName}>{m.name}</span>
								<span className={s.medCount}>{m.count} приём(ов)</span>
							</div>
							<span
								className={s.medBadge}
								style={{ color, borderColor: color }}
							>
								{label}
							</span>
						</li>
					)
				})}
			</ul>
		)}
	</div>
)

const ZonesBlock = ({ zones }) => {
	const empty = zones.max === 0
	return (
		<div className={`${s.block} ${s.blockZones}`}>
			<h3 className={s.blockTitle}>Карта зон боли</h3>
			{empty ? (
				<p className={s.empty}>Зоны боли не отмечены</p>
			) : (
				<>
					<div className={s.heads}>
						<div className={s.head}>
							<HeadFront zones={zones.colorMap} readOnly />
							<span className={s.headLabel}>Спереди</span>
						</div>
						<div className={s.head}>
							<HeadBack zones={zones.colorMap} readOnly />
							<span className={s.headLabel}>Сзади</span>
						</div>
					</div>
					<div className={s.legend}>
						<span className={`${s.legendDot} ${s.dotRed}`} />Часто
						<span className={`${s.legendDot} ${s.dotYellow}`} />Иногда
						<span className={`${s.legendDot} ${s.dotGreen}`} />Редко
					</div>
				</>
			)}
		</div>
	)
}

const PatternsBlock = ({ patterns }) => {
	return (
		<div className={s.grid}>
			<ListBlock
				title="Топ-триггеры"
				items={patterns.topTriggers}
				accent="rgba(92, 173, 228, 0.55)"
				emptyText="Триггеры не отмечены"
			/>
			<ListBlock
				title="Частые симптомы"
				items={patterns.topSymptoms}
				accent="rgba(168, 85, 247, 0.55)"
				emptyText="Симптомы не отмечены"
			/>
			<ZonesBlock zones={patterns.zones} />
			<MedsBlock items={patterns.meds} />
		</div>
	)
}

export default PatternsBlock
