import RangeSlider from '@/shared/ui/RangeSlider/RangeSlider'
import s from './Questionnaire.module.scss'

const SLEEP_LABELS = ['Очень плохо', 'Плохо', 'Нормально', 'Хорошо', 'Очень хорошо']

export default function MoodScale({ quality, value, onChange }) {
  const min = quality ? 1 : 0, max = quality ? 5 : 10
  const accentStrength = value == null ? 55 : 65 + 35 * (value - min) / (max - min)
  const label = value == null ? 'Выберите на шкале' : quality ? SLEEP_LABELS[value-1] : value <= 2 ? 'Спокойно' : value <= 4 ? 'Лёгкое напряжение' : value <= 7 ? 'Заметный стресс' : 'Сильный стресс'
  return <div className={s.scale} style={{ '--mood-strength': `${accentStrength}%` }}>
    <output className={s.moodValue}>{value == null ? '—' : quality ? `${value} / 5` : `${value} / 10`}</output>
    <span className={s.moodLabel}>{label}</span>
    <RangeSlider title={quality ? 'Качество сна' : 'Уровень стресса'}
      aria-label={quality ? 'Качество сна' : 'Уровень стресса'} min={min} max={max}
      value={value ?? (quality ? 3 : 5)} className={s.moodSlider} onChange={onChange} />
    {quality ? <div className={s.sleepStops}>{SLEEP_LABELS.map((description,index) => <button title={description} key={description}
      aria-label={description} aria-pressed={value===index+1}
      onClick={() => onChange(index+1)}>{index+1}</button>)}</div> : <div className={s.scaleEnds}><span>Спокойно</span><span>Очень сильный</span></div>}
  </div>
}
