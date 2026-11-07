import { useEffect, useRef, useState } from 'react'
import s from './Questionnaire.module.scss'

const ROW = 44
const wrap = (value, count) => (value % count + count) % count
const validValue = (value, min, max) => value === '' || /^\d{1,2}$/.test(String(value)) && Number(value) >= min && Number(value) <= max

/** A drum owns its gestures, so turning it never answers the card underneath. */
export default function SleepWheel({ label, unit, value, min = 0, max, initial, onChange, preview = false }) {
  const root = useRef(null)
  const input = useRef(null)
  const gesture = useRef(null)
  const latest = useRef({ value, onChange })
  const [drag, setDrag] = useState(0)
  const [editing, setEditing] = useState(() => !validValue(value, min, max))
  const [invalid, setInvalid] = useState(() => !validValue(value, min, max))
  const previousBounds = useRef({ min, max })
  const visibleEditing = editing && !preview
  const numeric = value === '' ? initial : Number(value)
  const base = Number.isInteger(numeric) && numeric >= min && numeric <= max ? numeric : initial
  const steps = Math.round(-drag / ROW)
  const wrapValue = next => min + wrap(next - min, max - min + 1)
  const center = wrapValue(base + steps)
  const remainder = drag + steps * ROW

  useEffect(() => { latest.current = { value, onChange } }, [value, onChange])
  useEffect(() => {
    const boundsChanged = previousBounds.current.min !== min || previousBounds.current.max !== max
    previousBounds.current = { min, max }
    if (boundsChanged && value !== '' && validValue(value, min, max)) {
      setInvalid(false)
      setEditing(false)
    }
  }, [min, max, value])
  useEffect(() => {
    if (visibleEditing) { input.current?.focus(); input.current?.select() }
  }, [visibleEditing])
  useEffect(() => {
    if (preview) return undefined
    const element = root.current
    let distance = 0
    let reset
    const turn = event => {
      if (event.target.closest('input')) return
      event.preventDefault()
      event.stopPropagation()
      distance += event.deltaY
      window.clearTimeout(reset)
      reset = window.setTimeout(() => { distance = 0 }, 140)
      const count = Math.trunc(distance / 28)
      if (!count) return
      distance -= count * 28
      const current = latest.current.value === '' ? initial : Number(latest.current.value)
      const next = String(min + wrap((Number.isFinite(current) ? current : initial) + count - min, max - min + 1))
      latest.current.value = next
      latest.current.onChange(next)
    }
    element.addEventListener('wheel', turn, { passive: false })
    return () => { element.removeEventListener('wheel', turn); window.clearTimeout(reset) }
  }, [initial, min, max, preview])

  const select = next => { onChange(String(wrapValue(next))); setInvalid(false) }
  const commit = () => {
    const valid = validValue(value, min, max)
    setInvalid(!valid)
    if (valid) setEditing(false)
    return valid
  }
  return <div className={s.wheelColumn}>
    <div ref={root} data-wheel data-turning={!!gesture.current} className={`${s.wheel} ${visibleEditing ? s.wheelEditing : ''}`} role="spinbutton"
      aria-label={label} aria-valuemin={min} aria-valuemax={max}
      aria-valuenow={value === '' ? undefined : base} aria-valuetext={value === '' ? 'Не выбрано' : `${value} ${unit}`}
      tabIndex={visibleEditing || preview ? -1 : 0}
      onKeyDown={event => {
        if (editing || preview) return
        if (['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', ' '].includes(event.key)) event.preventDefault()
        if (event.key === 'ArrowUp') select(base + 1)
        if (event.key === 'ArrowDown') select(base - 1)
        if (event.key === 'Home') select(min)
        if (event.key === 'End') select(max)
        if (event.key === 'Enter' || event.key === ' ') setEditing(true)
      }}
      onPointerDown={event => {
        if (editing || preview) return
        event.stopPropagation()
        gesture.current = { id: event.pointerId, y: event.clientY }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        if (gesture.current?.id !== event.pointerId) return
        setDrag(Math.max(-1500, Math.min(1500, event.clientY - gesture.current.y)))
      }}
      onPointerUp={event => {
        const start = gesture.current
        gesture.current = null
        if (!start || start.id !== event.pointerId) return
        const delta = event.clientY - start.y
        if (Math.abs(delta) < 6) setEditing(true)
        else select(base + Math.round(-delta / ROW))
        setDrag(0)
      }}
      onPointerCancel={() => { gesture.current = null; setDrag(0) }}>
      <div className={s.wheelSelection} aria-hidden="true" />
      {!visibleEditing && <div className={s.wheelNumbers} aria-hidden="true">{[-3,-2,-1,0,1,2,3].map(offset => {
        const position = offset * ROW + remainder
        return <span key={offset} style={{ transform: `translateY(${position}px) rotateX(${-position / ROW * 24}deg)`, opacity: Math.max(0, 1 - Math.abs(position) / 125) }}>{String(wrapValue(center + offset)).padStart(2, '0')}</span>
      })}</div>}
      {visibleEditing && <input ref={input} className={s.wheelInput} aria-label={`${label}: ручной ввод`} aria-invalid={invalid}
        type="text" inputMode="numeric" maxLength={2} value={value}
        onChange={event => { onChange(event.target.value.replace(/\D/g, '')); setInvalid(false) }} onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); if (commit()) root.current?.focus() }
          if (event.key === 'Escape') { event.stopPropagation(); setEditing(false); root.current?.focus() }
        }} />}
    </div>
    <span className={s.wheelUnit}>{invalid && !preview ? `От ${min} до ${max}` : unit}</span>
  </div>
}
