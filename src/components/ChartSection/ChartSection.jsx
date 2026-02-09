
import s from './ChartSection.module.scss'

const ChartSection = () =>{
	return(
		<div className={`${s.chartContent} ${s.flexItem}`}>
				<h2>График</h2>
				<div className={s.chart}></div>
				<p className={s.chartDescription}></p>
		</div>
	)
}

export default ChartSection