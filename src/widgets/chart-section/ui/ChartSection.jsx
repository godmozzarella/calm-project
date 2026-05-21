import s from './ChartSection.module.scss'

const ChartSection = () => {
	return (
		<div className={s.card}>
			<div className={s.cardHeader}>
				<h2 className={s.title}>График</h2>
				<span className={s.soon}>Скоро</span>
			</div>

			<div className={s.cardBody}>
				<div className={s.chartPlaceholder}>
					<div className={s.bars}>
						{[40, 70, 30, 90, 55, 75, 45, 60, 80, 35, 65, 50].map((h, i) => (
							<div key={i} className={s.bar} style={{ height: `${h}%` }} />
						))}
					</div>
				</div>
				<p className={s.hint}>Статистика приступов по дням — появится после накопления данных</p>
			</div>
		</div>
	)
}

export default ChartSection
