
import s from './ChartSection.module.scss'

const ChartSection = () =>{
	return(
		<section className={`${s.chartContent} ${s.flexItem}`}>
				<h2>График</h2>
				<div className={s.chart}></div>
				<p className={s.chartDescription}></p>
		</section>
	)
}

export default ChartSection