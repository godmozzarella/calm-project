import SleepWheel from './SleepWheel'
import MoodScale from './MoodScale'
import { DEFAULT_SLEEP_HOURS, DEFAULT_SLEEP_MINUTES } from './cards.mjs'
import yesterdayArtwork from './assets/yesterday.webp'
import todayArtwork from './assets/today.webp'
import sleepArtwork from './assets/sleep.webp'
import qualityArtwork from './assets/quality.webp'
import stressArtwork from './assets/stress.webp'
import medicationArtwork from './assets/medication.webp'
import alcoholArtwork from './assets/alcohol.webp'
import s from './Questionnaire.module.scss'

const dateLabel = key => new Date(`${key}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
const eyebrowFor = (card, yesterday, today) => ['yesterday','medication','alcohol'].includes(card) ? dateLabel(yesterday) : ['sleep','quality'].includes(card)?'Ваш сон':card==='stress'?'Самочувствие':dateLabel(today)
const titles = { yesterday: 'Новые приступы вчера?', today: 'Новый приступ сегодня?', sleep: 'Сколько вы спали?', quality: 'Как вам спалось?', stress: 'Какой сейчас стресс?', medication: 'Вчера принимали препараты?', alcohol: 'Вчера употребляли алкоголь?' }
const hints = { yesterday: 'Продолжение старого не считается.', today: 'До этого опроса.', sleep: 'Покрутите. Нажмите, чтобы ввести.', quality: 'Выберите и смахните.', stress: 'Выберите и смахните.', medication: 'От головной боли или для профилактики.', alcohol: 'Даже небольшое количество.' }

const artwork = {
  yesterday: yesterdayArtwork,
  today: todayArtwork,
  sleep: sleepArtwork,
  quality: qualityArtwork,
  stress: stressArtwork,
  medication: medicationArtwork,
  alcohol: alcoholArtwork,
}

export default function QuestionCardFace({ card, today, yesterday, fields, setFields, preview = false }) {
  return <>
    <div className={s.cardTop}>
      <span className={s.eyebrow}>{eyebrowFor(card,yesterday,today)}</span>
    </div>
    <h2>{titles[card]}</h2><p className={s.cardHint}>{hints[card]}</p>
    <div className={s.cardContent}>
      <img className={s.cardArtwork} src={artwork[card]} alt="" width="320" height="320" draggable={false} />
      {card==='sleep' && <div className={s.timeInputs}>
        <SleepWheel preview={preview} label="Часы сна" unit="часов" max={24} initial={DEFAULT_SLEEP_HOURS} value={fields.hours ?? ''} onChange={hours=>setFields(f=>({...f,hours,minutes:hours!=='' && (f.minutes ?? '')===''?String(DEFAULT_SLEEP_MINUTES):f.minutes}))}/>
        <span className={s.timeSeparator}>:</span>
        <SleepWheel preview={preview} label="Минуты сна" unit="минут" max={59} initial={DEFAULT_SLEEP_MINUTES} value={fields.minutes ?? ''} onChange={minutes=>setFields(f=>({...f,minutes,hours:minutes!=='' && (f.hours ?? '')===''?String(DEFAULT_SLEEP_HOURS):f.hours}))}/>
      </div>}
      {(card==='quality' || card==='stress') && <MoodScale quality={card==='quality'} value={fields[card==='quality'?'sleepQuality':'stress']} onChange={value=>setFields(f=>({...f,[card==='quality'?'sleepQuality':'stress']:value}))}/>}
    </div>
  </>
}
