import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { FieldError, Input } from '@/shared/ui/Input'
import s from './Questionnaire.module.scss'

const ROW = 44
const wrap = (value, count) => (value % count + count) % count
const validValue = (value, min, max) => value === '' || /^\d{1,2}$/.test(String(value)) && Number(value) >= min && Number(value) <= max

/** A drum owns its gestures, so turning it never answers the card underneath. */
export default function SleepWheel({ label, unit, value, min = 0, max, initial, onChange, preview = false }) {
  const errorId = useId()
  const root = useRef(null)
  const input = useRef(null)
  const gesture = useRef(null)
  const lastTap = useRef(null)
  const lastTick = useRef(-Infinity)
  const latest = useRef({ value, onChange })
  const [drag, setDrag] = useState(0)
  const [editing, setEditing] = useState(() => !validValue(value, min, max))
  const [confirmed, setConfirmed] = useState(false)
  const [invalid, setInvalid] = useState(() => !validValue(value, min, max))
  const previousBounds = useRef({ min, max })
  const visibleEditing = editing && !preview
  const numeric = value === '' ? initial : Number(value)
  const base = Number.isInteger(numeric) && numeric >= min && numeric <= max ? numeric : initial
  const steps = Math.round(-drag / ROW)
  const wrapValue = next => min + wrap(next - min, max - min + 1)
  const center = wrapValue(base + steps)
  const remainder = drag + steps * ROW

  const tick = useCallback(() => {
    if (preview || typeof navigator.vibrate !== 'function') return
    const now = performance.now()
    if (now - lastTick.current < 40) return
    lastTick.current = now
    navigator.vibrate(20)
  }, [preview])

  useEffect(() => { latest.current = { value, onChange } }, [value, onChange])
  useEffect(() => {
    const boundsChanged = previousBounds.current.min !== min || previousBounds.current.max !== max
    previousBounds.current = { min, max }
    if (boundsChanged && value !== '' && validValue(value, min, max)) {
      setInvalid(false)
      setEditing(false)
    }
  }, [min, max, value])
  useLayoutEffect(() => {
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
      tick()
    }
    element.addEventListener('wheel', turn, { passive: false })
    return () => { element.removeEventListener('wheel', turn); window.clearTimeout(reset) }
  }, [initial, min, max, preview, tick])

  const select = next => {
    const selected = wrapValue(next)
    if (selected !== base) tick()
    onChange(String(selected))
    setInvalid(false)
  }
  const commit = () => {
    const valid = validValue(value, min, max)
    setInvalid(!valid)
    if (valid) setEditing(false)
    return valid
  }
  return <div className={s.wheelColumn}>
    <div ref={root} data-wheel data-confirmed={confirmed || undefined} data-turning={!!gesture.current} className={`${s.wheel} ${visibleEditing ? s.wheelEditing : ''}`} role="spinbutton"
      aria-label={label} aria-valuemin={min} aria-valuemax={max}
      aria-valuenow={value === '' ? undefined : base} aria-valuetext={value === '' ? 'Не выбрано' : `${value} ${unit}`}
      tabIndex={visibleEditing || preview ? -1 : 0}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setConfirmed(false) }}
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
        if (editing || preview || !event.isPrimary || event.button !== 0) return
        event.stopPropagation()
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        if (gesture.current?.id !== event.pointerId) return
        const nextDrag = Math.max(-1500, Math.min(1500, event.clientY - gesture.current.y))
        const nextStep = Math.round(-nextDrag / ROW)
        if (nextStep !== (gesture.current.step ?? 0)) {
          gesture.current.step = nextStep
          tick()
        }
        setDrag(nextDrag)
      }}
      onPointerUp={event => {
        const start = gesture.current
        gesture.current = null
        if (!start || start.id !== event.pointerId) return
        const delta = event.clientY - start.y
        setDrag(0)
        const rect = event.currentTarget.getBoundingClientRect()
        const centered = Math.abs(event.clientY - rect.top - rect.height / 2) <= ROW / 2
        const tapped = Math.hypot(event.clientX - start.x, delta) < 6 && event.timeStamp - start.time < 400
        if (!tapped || !centered) {
          lastTap.current = null
          if (Math.abs(delta) >= 6) select(base + Math.round(-delta / ROW))
          return
        }
        const previous = lastTap.current
        if (previous && event.pointerType === previous.type && event.timeStamp - previous.time <= 350) {
          lastTap.current = null
          flushSync(() => setEditing(true))
        } else {
          lastTap.current = { type: event.pointerType, time: event.timeStamp }
        }
      }}
      onPointerCancel={() => { gesture.current = null; lastTap.current = null; setDrag(0) }}>
      <div className={s.wheelSelection} aria-hidden="true" hidden={visibleEditing} />
      {!visibleEditing && <div className={s.wheelNumbers} data-wheel-numbers aria-hidden="true">{[-3,-2,-1,0,1,2,3].map(offset => {
        const position = offset * ROW + remainder
        return <span key={offset} style={{ transform: `translateY(${position}px) rotateX(${-position / ROW * 24}deg)`, opacity: Math.max(0, 1 - Math.abs(position) / 125) }}>{String(wrapValue(center + offset)).padStart(2, '0')}</span>
      })}</div>}
      {visibleEditing && <Input inputRef={input} className={s.wheelInput} wrapperClassName={s.wheelInputWrap} aria-label={`${label}: ручной ввод`} aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined}
        type="text" inputMode="numeric" maxLength={2} value={value}
        onChange={event => { onChange(event.target.value.replace(/\D/g, '')); setInvalid(false) }} onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault()
            if (commit()) {
              setConfirmed(true)
              root.current?.focus()
            }
          }
          if (event.key === 'Escape') { event.stopPropagation(); setEditing(false); root.current?.focus() }
        }} />}
    </div>
    <span className={s.wheelUnit}>{unit}</span>
    <FieldError id={errorId}>{invalid && !preview ? `От ${min} до ${max}` : null}</FieldError>
  </div>
}
