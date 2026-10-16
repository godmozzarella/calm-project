import s from './RiskQualityBlock.module.scss'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'

const formatPercent = value => value == null ? '—' : `${value}%`

const Metric = ({ label, value, detail }) => (
	<div className={s.metric}>
		<span className={s.metricLabel}>{label}</span>
		<strong className={s.metricValue}>{value}</strong>
		{detail && <span className={s.metricDetail}>{detail}</span>}
	</div>
)

const RiskQualityBlock = ({ quality, error }) => (
	<section className={s.card}>
		<h2 className={s.title}>Проверка персонального прогноза</h2>
		<p className={s.intro}>Последние 90 завершённых дней. Учитываются только оценки, сохранённые до начала дня по времени выбранного города. Предупреждение — от 35 баллов.</p>
		<ErrorNotice message={error} title="Не удалось загрузить метрики" />
		{!quality && !error && <p className={s.note}>Загружаем метрики...</p>}
		{quality && <>
			<div className={s.grid}>
				<Metric label="Дней с прогнозом" value={quality.daysCovered} detail="из последних 90" />
				<Metric label="Дней с приступом" value={quality.attackDays} detail="среди дней с прогнозом" />
				{quality.enoughData && <>
					<Metric label="Замечено дней с приступом" value={formatPercent(quality.recallPercent)} detail={`${quality.hitDays} из ${quality.attackDays}`} />
					<Metric label="Приступ после предупреждения" value={formatPercent(quality.precisionPercent)} detail={`${quality.hitDays} из ${quality.alertDays} предупреждений`} />
					<Metric label="Ложных предупреждений" value={quality.falseAlertDays} detail="дней без начала приступа" />
					<Metric label="Частота приступов" value={formatPercent(quality.baselineAttackRatePercent)} detail="среди дней с прогнозом" />
				</>}
			</div>
			{!quality.enoughData && <p className={s.note}>Для расчёта долей нужно не менее 30 дней с сохранённым прогнозом, включая хотя бы 5 дней с началом приступа и 5 дней без него. Пока накапливаем данные.</p>}
			<p className={s.footer}>Оценка 0–100 — балл по правилам, а не вероятность приступа. Метрики относятся только к дням с предварительным прогнозом.</p>
		</>}
	</section>
)

export default RiskQualityBlock
