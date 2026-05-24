import s from './AttackZoneSection.module.scss'

const AttackZoneSection = () => {
	return (
		<div className={s.card}>
			<div className={s.cardHeader}>
				<h2 className={s.title}>Зоны боли</h2>
			</div>

			<div className={s.cardBody}>
				<div className={s.headsRow}>
					<div className={s.headView}>
						<div className={s.headPlaceholder} />
						<span className={s.headLabel}>Спереди</span>
					</div>
					<div className={s.dividerV} />
					<div className={s.headView}>
						<div className={s.headPlaceholder} />
						<span className={s.headLabel}>Сзади</span>
					</div>
				</div>
				<p className={s.hint}>Нажмите на область чтобы отметить зону боли</p>
			</div>
		</div>
	)
}

export default AttackZoneSection
