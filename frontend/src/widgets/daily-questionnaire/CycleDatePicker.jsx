import { useState } from 'react'
import SleepWheel from './SleepWheel'
import { changeCyclePart, cycleDateParts, maxCycleDay } from './cycleDate.mjs'
import s from './Questionnaire.module.scss'

const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

export default function CycleDatePicker({ fields, today, onChange, preview = false }) {
  const [pickerEpoch, setPickerEpoch] = useState(0)
  const current = cycleDateParts(today)
  const saved = cycleDateParts(fields.cycleStart)
  const day = fields.cycleDay ?? saved.day
  const month = fields.cycleMonth ?? saved.month
  const shownMonth = Number(month || current.month)
  const shownDay = Math.min(Number(day || current.day), maxCycleDay(shownMonth, today))
  const selected = Boolean(day || month)
  const change = (part, value) => onChange(fields => changeCyclePart(fields, part, value, today))
  const reset = () => {
    onChange(value => ({ ...value, cycleDay: '', cycleMonth: '', cycleStart: '' }))
    setPickerEpoch(epoch => epoch + 1)
  }

  return <div className={s.cycleDate}>
    <span>Первый день цикла</span>
    <div className={s.cycleWheels}>
      <SleepWheel key={`day-${pickerEpoch}`} preview={preview} label="День начала цикла" unit="день" min={1} max={maxCycleDay(shownMonth, today)}
        initial={shownDay} value={day} onChange={value => change('day', value)}/>
      <SleepWheel key={`month-${pickerEpoch}`} preview={preview} label="Месяц начала цикла" unit={months[shownMonth - 1] || 'месяц'} min={1} max={12}
        initial={Number(current.month)} value={month} onChange={value => change('month', value)}/>
    </div>
    <span className={s.cycleDateStatus}>
      {fields.cycleStart ? `${Number(day)} ${months[Number(month)-1]}` : selected ? 'Проверьте дату' : 'Дата не выбрана'}
      {selected && <button type="button" onClick={reset}>Сбросить</button>}
    </span>
  </div>
}
