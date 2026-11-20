import { useState } from 'react'
import { Input } from '@/shared/ui/Input'
import cycleArtwork from './assets/cycle.webp'
import endArtwork from './assets/cycle-end.webp'
import { cycleCards } from './cycleCards.mjs'
import s from './Questionnaire.module.scss'

const dateLabel = value => new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

function CycleDateEntry({ question, choice, busy, onAnswer, onCancel }) {
  const { type, today, start, end } = question
  const { isEnd } = cycleCards[type]
  const [date, setDate] = useState(choice === 'FIX_END' ? end : '')
  const shift = choice === 'SHIFT'
  const valid = date && (shift ? date > today : date <= today && (!isEnd || date >= start))

  return <div className={s.cycleDateEntry}>
    <Input type="date" label={isEnd ? 'Последний день' : 'Дата начала'} value={date}
      min={isEnd ? start : shift ? today : undefined} max={shift ? undefined : today}
      onChange={event => setDate(event.target.value)} disabled={busy} />
    <div className={s.cycleLinks}>
      <button className={s.subtle} type="button" disabled={busy} onClick={onCancel}>Назад</button>
      <button className={s.primary} type="button" disabled={busy || !valid}
        onClick={() => onAnswer({ choice, date })}>Сохранить дату</button>
    </div>
  </div>
}

export default function CycleQuestionCard({ question, dateChoice, busy, onAnswer, onCancelDate }) {
  const { type, start, end } = question
  const { title, hint, isEnd } = cycleCards[type]
  const endDay = end && start ? (Date.parse(end) - Date.parse(start)) / 86400000 + 1 : null
  return <>
    <div className={s.cardTop}><span className={s.eyebrow}>Ваш цикл</span></div>
    <h2>{title}</h2>
    <p className={s.cardHint}>{type === 'AUTO_CLOSED' ? `${endDay}-й день, ${dateLabel(end)}.` : hint}</p>
    <div className={s.cardContent}>
      <img className={s.cardArtwork} src={isEnd ? endArtwork : cycleArtwork} alt="" width="320" height="320" draggable={false} />
      {dateChoice && <CycleDateEntry key={dateChoice} question={question} choice={dateChoice} busy={busy}
        onAnswer={onAnswer} onCancel={onCancelDate} />}
    </div>
  </>
}

export function CycleQuestionOptions({ type, busy, onPickDate, onAnswer }) {
  const [expanded, setExpanded] = useState(false)
  const { date, snooze } = cycleCards[type]
  if (type === 'AUTO_CLOSED') return null
  return <div className={s.cycleOptions}>
    <div className={s.cycleLinks}>
      {date && <button className={s.subtle} type="button" disabled={busy} onClick={() => onPickDate(date[0])}>{date[1]}</button>}
      <button className={s.subtle} type="button" disabled={busy} aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}>Ещё</button>
    </div>
    {expanded && <>
      {snooze && <div className={s.cycleLinks}>
        <span>Не спрашивать</span>
        {[3, 7, 14].map(days => <button key={days} className={s.subtle} type="button" disabled={busy}
          onClick={() => onAnswer({ choice: 'SNOOZE', days })}>{days} {days === 3 ? 'дня' : 'дней'}</button>)}
      </div>}
      <button className={s.subtle} type="button" disabled={busy}
        onClick={() => onAnswer({ choice: 'DISABLE' })}>Месячных сейчас нет и не будет</button>
    </>}
  </div>
}
