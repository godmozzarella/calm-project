import s from './Questionnaire.module.scss'

const SLEEP_COLORS = ['#E4A998', '#DDB78E', '#A9BED6', '#91C7BE', '#82CDB3']
const STRESS_COLORS = ['#82CDB3', '#8ACBB9', '#95C7C1', '#9DC2D2', '#AAB9DB', '#B6B0D7', '#C5AAD0', '#D2A5BC', '#DEA4AC', '#E5A497', '#E8A08E']
const SLEEP_LABELS = ['Очень плохо', 'Плохо', 'Нормально', 'Хорошо', 'Очень хорошо']

export default function MoodScale({ quality, value, onChange }) {
  const min = quality ? 1 : 0, max = quality ? 5 : 10
  const color = value == null ? '#A9BED6' : (quality ? SLEEP_COLORS[value-1] : STRESS_COLORS[value])
  const label = value == null ? 'Выберите на шкале' : quality ? SLEEP_LABELS[value-1] : value <= 2 ? 'Спокойно' : value <= 4 ? 'Лёгкое напряжение' : value <= 7 ? 'Заметный стресс' : 'Сильный стресс'
  return <div className={s.scale} style={{ '--mood-color': color }}>
    <output className={s.moodValue}>{value == null ? '—' : quality ? `${value} / 5` : `${value} / 10`}</output>
    <span className={s.moodLabel}>{label}</span>
    <input type="range" aria-label={quality ? 'Качество сна' : 'Уровень стресса'} min={min} max={max} value={value ?? (quality ? 3 : 5)}
      onPointerDown={event => {
        const rect = event.currentTarget.getBoundingClientRect()
        onChange(Math.max(min, Math.min(max, Math.round(min + (event.clientX-rect.left)/rect.width*(max-min)))))
      }} onChange={event => onChange(Number(event.target.value))}/>
    {quality ? <div className={s.sleepStops}>{SLEEP_COLORS.map((tint,index) => <button key={index} style={{ '--stop-color':tint }}
      className={value===index+1?s.selectedStop:''} aria-label={SLEEP_LABELS[index]} aria-pressed={value===index+1}
      onClick={() => onChange(index+1)}>{index+1}</button>)}</div> : <div className={s.scaleEnds}><span>Спокойно</span><span>Очень сильный</span></div>}
  </div>
}
