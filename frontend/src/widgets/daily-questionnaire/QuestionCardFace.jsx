import SleepWheel from './SleepWheel'
import MoodScale from './MoodScale'
import { CalmSparkIcon } from '@/shared/ui/icons'
import s from './Questionnaire.module.scss'

const dateLabel = key => new Date(`${key}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
const eyebrowFor = (card, yesterday, today) => ['yesterday','medication','alcohol'].includes(card) ? dateLabel(yesterday) : ['sleep','quality'].includes(card)?'Ваш сон':card==='stress'?'Самочувствие':['cycle','cycleEnd'].includes(card)?'Ваш цикл':dateLabel(today)
const titles = { yesterday: 'Новые приступы вчера?', today: 'Новый приступ сегодня?', sleep: 'Сколько вы спали?', quality: 'Как вам спалось?', stress: 'Какой сейчас стресс?', medication: 'Вчера принимали препараты?', alcohol: 'Вчера употребляли алкоголь?', cycle: 'Месячные начались сегодня?', cycleEnd: 'Месячные закончились сегодня?' }
const hints = { yesterday: 'Продолжение старого не считается.', today: 'До этого опроса.', sleep: 'Покрутите. Нажмите, чтобы ввести.', quality: 'Выберите и смахните.', stress: 'Выберите и смахните.', medication: 'От головной боли или для профилактики.', alcohol: 'Даже небольшое количество. Если не помните — выберите «Не знаю».', cycle: 'Да — отметим сегодняшний день в календаре.', cycleEnd: 'Да — сегодня последний день. Если он был раньше, отметьте его в календаре.' }

export default function QuestionCardFace({ card, today, yesterday, fields, setFields, preview = false }) {
  return <>
    <CalmSparkIcon className={s.cardWatermark}/>
    <div className={s.cardTop}><span className={s.eyebrow}>{eyebrowFor(card,yesterday,today)}</span><CalmSparkIcon className={s.cardSpark}/></div>
    <h2>{titles[card]}</h2><p className={s.cardHint}>{hints[card]}</p>
    <div className={s.cardContent}>
      {card==='sleep' && <div className={s.timeInputs}>
        <SleepWheel preview={preview} label="Часы сна" unit="часов" max={24} initial={7} value={fields.hours} onChange={hours=>setFields(f=>({...f,sleepTouched:true,hours,minutes:hours!=='' && f.minutes===''?'0':f.minutes}))}/>
        <span className={s.timeSeparator}>:</span>
        <SleepWheel preview={preview} label="Минуты сна" unit="минут" max={59} initial={0} value={fields.minutes} onChange={minutes=>setFields(f=>({...f,sleepTouched:true,minutes,hours:minutes!=='' && f.hours===''?'7':f.hours}))}/>
      </div>}
      {(card==='quality' || card==='stress') && <MoodScale quality={card==='quality'} value={fields[card==='quality'?'sleepQuality':'stress']} onChange={value=>setFields(f=>({...f,[card==='quality'?'sleepQuality':'stress']:value}))}/>}
      {!['sleep','quality','stress'].includes(card) && <div className={s.calmScene} aria-hidden="true"><CalmSparkIcon/><span/><i/></div>}
    </div>
  </>
}
