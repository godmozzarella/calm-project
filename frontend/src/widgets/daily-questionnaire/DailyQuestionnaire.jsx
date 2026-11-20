import { FieldError } from '@/shared/ui/Input'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { questionnaireApi, browserTimezone } from '@/shared/api/questionnaireApi'
import { attackApi } from '@/shared/api'
import { useAddAttack, AddAttackForm } from '@/features/add-attack'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import { notifyRequestError } from '@/shared/lib/notifyError'
import { emit, subscribe, CYCLE_CHANGED, PROFILE_CHANGED, SURVEY_COMPLETED, OPEN_DAILY_QUESTIONNAIRE } from '@/shared/lib/dataEvents'
import { cardsFor, swipeDirection, answerFor, emptyAnswers, actionLabels } from './cards.mjs'
import QuestionCardFace from './QuestionCardFace'
import CycleQuestionCard, { CycleQuestionOptions } from './CycleQuestionCard'
import { cycleCards } from './cycleCards.mjs'
import { ArrowBackRoundedIcon, CalmSparkIcon } from '@/shared/ui/icons'
import CloseButton from '@/shared/ui/Button/CloseButton'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import s from './Questionnaire.module.scss'

const dateLabel = key => new Date(`${key}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
const previousDate = key => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const ChoiceGlyph = ({card,side}) => side==='left' ? ['quality','stress'].includes(card) ? <SaveRoundedIcon aria-hidden="true"/> : <CloseRoundedIcon aria-hidden="true"/> : ['quality','stress','sleep'].includes(card) ? <SaveRoundedIcon aria-hidden="true"/> : <CheckRoundedIcon aria-hidden="true"/>

export default function DailyQuestionnaire({ userId }) {
  const [status,setStatus] = useState(null)
  const [open,setOpen] = useState(false)
  const [answers,setAnswers] = useState(emptyAnswers)
  const [fields,setFields] = useState({ hours:'', minutes:'', sleepQuality:null, stress:null })
  const [index,setIndex] = useState(0)
  const [busy,setBusy] = useState(false)
  const [toast,setToast] = useState('')
  const [motion,setMotion] = useState('')
  const [attackFlow,setAttackFlow] = useState(null)
  const [attackError,setAttackError] = useState('')
  const attackSession = useRef(null)
  const [completePending,setCompletePending] = useState(null)
  const [cycleQuestion, setCycleQuestion] = useState(null)
  const [cycleDateChoice, setCycleDateChoice] = useState(null)
  const pointer = useRef(null), dragFrame = useRef(null), cardNode = useRef(null)
  const middleNode = useRef(null), backNode = useRef(null)
  const leftCue = useRef(null), rightCue = useRef(null), downCue = useRef(null)
  const pending = useRef(false), timers = useRef([]), dialog = useRef(null)
  const draftKey = status ? `calm:survey-draft:${userId}:${status.date}` : null
  const later = (fn, ms) => { const t=window.setTimeout(fn,ms); timers.current.push(t); return t }
  useEffect(() => () => { timers.current.forEach(window.clearTimeout); if(dragFrame.current) window.cancelAnimationFrame(dragFrame.current) }, [])
  useBodyScrollLock(open)
  useEffect(() => {
    if (!open) return
    const root=document.getElementById('root'), wasInert=root?.inert
    if(root) root.inert=true
    const streakButton = document.querySelector('[data-streak-target]')
    const survey = dialog.current?.firstElementChild
    survey?.focus({ preventScroll: true })
    const trap=e => {
      if(e.key!=='Tab') return
      const scope=dialog.current?.querySelector('[data-attack-form]') || dialog.current
      const focusable=[...scope?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)') || []].filter(el => el.getClientRects().length)
      if(!focusable.length) { e.preventDefault(); return }
      const first=focusable[0], last=focusable.at(-1)
      if(e.shiftKey && (document.activeElement===first || document.activeElement===survey)) { e.preventDefault(); last.focus() }
      if(!e.shiftKey && document.activeElement===last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown',trap)
    return () => { if(root) root.inert=wasInert; window.removeEventListener('keydown',trap); streakButton?.focus({ preventScroll:true }) }
  }, [open])
  useEffect(() => {
    if(!open || !draftKey) return
    try { sessionStorage.setItem(draftKey,JSON.stringify({version:4,answers,fields,index})) } catch { /* Draft is optional. */ }
  }, [open,draftKey,answers,fields,index])
  const cards=cardsFor(answers), card=cards[index]
  const cycleType = cycleQuestion?.question.type
  const cycleCard = cycleCards[cycleType]
  const activeCard = cycleCard ? (cycleCard.isEnd ? 'cycleEnd' : 'cycle') : card
  const labels = cycleCard ? [cycleCard.left[1], cycleCard.right[1]] : actionLabels(card)
  const step = index + (cycleCard ? 2 : 1)
  const totalSteps = cards.length + Number(Boolean(cycleCard))
  const yesterday=status ? previousDate(status.date):''
  const deckCards = card === 'sleep' ? cardsFor({ ...answers, sleepMinutes: 1 }) : cards
  const nextCard = cards[index+1]
  const afterNextCard = deckCards[index+2]
  const attackDay=attackFlow==='yesterday'?yesterday:status?.date
  const attack = useAddAttack({ date: attackDay, onSuccess: saved => {
    const session = attackSession.current
    if(!session) return
    if(!saved) { attackSession.current=null; setAttackFlow(null); return }
    session.saved=true
    if(session.repeat) {
      session.repeat=false
      later(()=>{ if(attackSession.current===session) attack.openForm({startDate:session.day,requireStartTime:true}) },0)
    } else {
      attackSession.current=null
      setAttackFlow(null)
      advance({[session.card]:'YES'},'right')
    }
  } })
  const notify = message => { setToast(message); setMotion('bounce'); later(()=>setMotion(''),400); later(()=>setToast(''),2300) }
  const start = useCallback(async () => {
    // Refresh the server date before resuming a draft (a tab may have stayed open overnight).
    try {
      const fresh=await questionnaireApi.status(); setStatus(fresh)
      const saved=fresh.today?.answers
      let draft=null
      try { draft=JSON.parse(sessionStorage.getItem(`calm:survey-draft:${userId}:${fresh.date}`)||'null') } catch { /* Ignore old drafts. */ }
      const a={...emptyAnswers(),...(draft?.answers || saved || {})}
      a.ongoing ??= 'UNKNOWN'
      const cycleAnswers = fresh.profile?.trackCycle && fresh.profile?.sex === 'FEMALE'
        ? (draft?.version >= 3 ? draft.answers : saved) : null
      a.menstruating=cycleAnswers?.menstruating ?? null
      a.cycleStart=cycleAnswers?.cycleStart ?? null
      a.cycleEnded=cycleAnswers?.cycleEnded ?? null
      const savedFields = draft?.fields || { hours:a.sleepMinutes>0?Math.floor(a.sleepMinutes/60):'',minutes:a.sleepMinutes>0?a.sleepMinutes%60:'',sleepQuality:a.sleepQuality,stress:a.stress }
      const savedIndex=Number.isInteger(draft?.index)?draft.index:0
      const previousIndex = draft?.version >= 2 || savedIndex <= 2 ? savedIndex : savedIndex - 1
      // Older drafts reached stress after sleep quality. Continue from stress in the new order.
      const resumeIndex = (draft?.version ?? 0) < 4 && a.sleepMinutes > 0 && previousIndex === 4 ? 3 : previousIndex
      setAnswers(a); setFields(savedFields); setIndex(Math.max(0,Math.min(resumeIndex,cardsFor(a).length-1)))
      setCycleQuestion(null)
      setCycleDateChoice(null)
      setToast('')
      setOpen(true)
    } catch(e) { notifyRequestError(e, 'Не удалось открыть карточки') }
  }, [userId])
  useEffect(() => subscribe(OPEN_DAILY_QUESTIONNAIRE, start), [start])
  const close = () => { if(pending.current || motion || busy || attack.loading || attack.deleting) return; setOpen(false); setCycleQuestion(null); setCycleDateChoice(null); setAttackFlow(null); attackSession.current=null; attack.closeForm(); setMotion('') }
  const submit = async a => {
    if(pending.current) return
    pending.current=true; setBusy(true); setCompletePending(a)
    try {
      const saved=await questionnaireApi.submit(status.date,status.today?.timezone || browserTimezone(),a)
      setStatus(prev=>({...prev,today:saved.entry,currentStreak:saved.currentStreak}))
      setCompletePending(null)
      setOpen(false)
      later(()=>{
        const target=document.querySelector('[data-streak-target]')
        const rect=target?.getBoundingClientRect()
        if(rect && (rect.top<0 || rect.bottom>window.innerHeight)) target.scrollIntoView({block:'nearest',behavior:'auto'})
        emit(SURVEY_COMPLETED,{currentStreak:saved.currentStreak,newCompletion:saved.newCompletion,completedToday:true})
      },0)
      try { sessionStorage.removeItem(draftKey) } catch { /* Storage may be unavailable. */ }
    } catch(e) { notifyRequestError(e, 'Не удалось сохранить карточки', 'Ответы остались на месте. Повторите сохранение.') }
    finally { pending.current=false; setBusy(false) }
  }
  const finish = async next => {
    if (status.profile?.trackCycle && status.profile?.sex === 'FEMALE') {
      setBusy(true)
      try {
        const question = await questionnaireApi.claimCycleQuestion()
        if (cycleCards[question?.type]) {
          setCycleQuestion({ question, answers: next })
          return
        }
      } catch (error) {
        notifyRequestError(error, 'Не удалось загрузить вопрос о цикле')
      } finally {
        setBusy(false)
      }
    }
    submit(next)
  }
  const answerCycle = async (response, direction) => {
    if (busy || motion || !cycleQuestion) return
    setBusy(true)
    const { question, answers: finalAnswers } = cycleQuestion
    let next = finalAnswers
    try {
      await questionnaireApi.answerCycleQuestion(question, response)
      emit(CYCLE_CHANGED)
      if (response.choice === 'DISABLE') {
        next = { ...finalAnswers, menstruating: null, cycleStart: null, cycleEnded: null }
        setStatus(prev => ({ ...prev, profile: { ...prev.profile, trackCycle: false } }))
        emit(PROFILE_CHANGED)
      } else if (response.choice === 'NO') {
        next = { ...finalAnswers, cycleStart: null, menstruating: question.type === 'END' ? null : 'NO',
          cycleEnded: question.type === 'END' ? 'NO' : null }
      }
    } catch (error) {
      clearDragVisual(true)
      notifyRequestError(error, 'Не удалось сохранить ответ о цикле')
      if (error.status !== 409) return
    } finally {
      setBusy(false)
    }
    const complete = () => {
      setCycleQuestion(null)
      setCycleDateChoice(null)
      setAnswers(next)
      submit(next)
    }
    if (direction) dismissCard(direction, complete)
    else complete()
  }
  const dismissCard = (direction, onDismissed) => {
    setMotion(direction)
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const node=cardNode.current
    const animated=Boolean(node && typeof node.animate==='function' && !reduced)
    if(animated) {
      // The visible card leaves while the two cards behind it finish the same gesture.
      for (const [behind, transform] of [[middleNode.current,'translateY(0) scale(1)'],[backNode.current,'translateY(28px) scale(.94)']]) {
        if (!behind) continue
        behind.getBoundingClientRect()
        behind.style.transition='transform 220ms ease-out'
        behind.style.transform=transform
      }
      const from=node.style.transform || 'none'
      const to=direction==='left'?'translateX(-110vw) rotate(-18deg)':direction==='down'?'translateY(110vh)':'translateX(110vw) rotate(18deg)'
      node.animate([{transform:from,opacity:1},{transform:to,opacity:0}],{duration:220,easing:'ease-in',fill:'forwards'})
    }
    later(()=> {
      for (const behind of [middleNode.current,backNode.current]) if (behind) { behind.style.transition=''; behind.style.transform='' }
      setMotion('')
      onDismissed()
    },animated?220:0)
  }
  const advance = (patch, direction) => {
    const next={...answers,...patch}; setToast(''); setAnswers(next)
    dismissCard(direction, () => {
      if(index>=cardsFor(next).length-1) finish(next); else setIndex(i=>i+1)
    })
  }
  const choose = async direction => {
    if(busy || pending.current || motion || attackFlow || !card || completePending) return
    if (cycleCard) {
      if (cycleDateChoice) return
      const choice = direction === 'down' ? 'SKIP' : cycleCard[direction][0]
      if (choice === 'FIX_END') {
        clearDragVisual(true)
        setCycleDateChoice(choice)
      } else await answerCycle({ choice }, direction)
      return
    }
    try {
      const patch=answerFor(card,direction,fields)
      if(patch[card]==='YES' && ['yesterday','today'].includes(card)) {
        const day=card==='yesterday'?yesterday:status.date
        clearDragVisual(true)
        setBusy(true)
        try {
          const list=await attackApi.getByDate(day)
          const existing=list.filter(a => a.startDate===day)
            .sort((a,b)=>`${b.startDate}T${b.startTime || ''}`.localeCompare(`${a.startDate}T${a.startTime || ''}`))[0]
          attackSession.current={card,day,saved:false,repeat:false}
          setAttackFlow(card)
          setAttackError('')
          if(existing) attack.openEditForm(existing)
          else attack.openForm({startDate:day,requireStartTime:true})
        } catch(error) { notifyRequestError(error, 'Не удалось загрузить приступы') } finally { setBusy(false) }
        return
      }
      advance(patch,direction)
    } catch(e) {
      clearDragVisual(true)
      notify(e.message)
    }
  }
  const closeAttack = () => {
    if(attack.loading || attack.deleting) return
    const session=attackSession.current
    attack.closeForm()
    attackSession.current=null
    setAttackFlow(null)
    setAttackError('')
    if(session?.saved) advance({[session.card]:'YES'},'right')
  }
  const saveAttack = (repeat=false) => {
    const session=attackSession.current
    if(!session || attack.loading || attack.deleting) return
    if(attack.form.startDate!==session.day) {
      setAttackError({ field: 'startDate', message: `Укажите начало приступа за ${dateLabel(session.day)}` })
      return
    }
    session.repeat=repeat
    setAttackError('')
    attack.submit()
  }
  const moveRearCards = (dx,dy) => {
    const progress=Math.min(1,Math.max(Math.abs(dx),Math.max(0,dy))/150)
    if(middleNode.current) {
      middleNode.current.style.transition='none'
      middleNode.current.style.transform=`translateY(${28*(1-progress)}px) scale(${.94+.06*progress})`
    }
    if(backNode.current) {
      backNode.current.style.transition='none'
      backNode.current.style.transform=`translateY(${50-22*progress}px) scale(${.88+.06*progress})`
    }
  }
  const clearDragVisual = (animateBack, keepTransform = false) => {
    if(dragFrame.current) window.cancelAnimationFrame(dragFrame.current)
    dragFrame.current=null
    const node=cardNode.current
    if(node && !keepTransform) { node.style.transition=animateBack?'transform .16s ease-out':'none'; node.style.transform='' }
    if (!keepTransform) for (const behind of [middleNode.current,backNode.current]) if (behind) {
      behind.style.transition=animateBack?'transform .16s ease-out':'none'
      behind.style.transform=''
    }
    leftCue.current?.classList.remove(s.gestureCueVisible)
    rightCue.current?.classList.remove(s.gestureCueVisible)
    downCue.current?.classList.remove(s.unknownCueVisible)
  }
  const onPointerDown = e => {
    if(e.target.closest('input,button,select,label,a,[data-wheel]') || busy || motion || attackFlow || completePending || cycleDateChoice) return
    pointer.current={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0}
    cardNode.current=e.currentTarget
    e.currentTarget.style.transition='none'
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = e => {
    const p=pointer.current
    if(!p || p.id!==e.pointerId) return
    p.dx=e.clientX-p.x; p.dy=Math.max(-25,e.clientY-p.y)
    if(dragFrame.current) return
    dragFrame.current=window.requestAnimationFrame(()=>{
      dragFrame.current=null
      const current=pointer.current
      if(!current || !cardNode.current) return
      const {dx,dy}=current
      cardNode.current.style.transform=`translate(${dx}px, ${dy}px) rotate(${dx/28}deg)`
      moveRearCards(dx,dy)
      leftCue.current?.classList.toggle(s.gestureCueVisible,dx < -12 && Math.abs(dx)>=dy)
      rightCue.current?.classList.toggle(s.gestureCueVisible,dx > 12 && Math.abs(dx)>=dy)
      downCue.current?.classList.toggle(s.unknownCueVisible,dy > 12 && dy > Math.abs(dx))
    })
  }
  const onPointerUp = e => {
    const p=pointer.current
    if(!p || p.id!==e.pointerId) return
    pointer.current=null
    const dx=e.clientX-p.x, dy=Math.max(-25,e.clientY-p.y)
    const direction=swipeDirection(dx,dy)
    if(direction && cardNode.current) {
      cardNode.current.style.transform=`translate(${dx}px, ${dy}px) rotate(${dx/28}deg)`
      moveRearCards(dx,dy)
    }
    clearDragVisual(!direction,Boolean(direction))
    if(direction) choose(direction)
  }
  const onPointerCancel = () => { pointer.current=null; clearDragVisual(true) }
  if (!open) return null
  return createPortal(
    <div ref={dialog} className={s.modalRoot} onKeyDown={e=>{if(e.key==='Escape' && !attack.open) close()}}>
      <div className={s.overlay} tabIndex={-1} inert={attack.open} aria-hidden={attack.open || undefined} role="dialog" aria-modal="true" aria-label="Ежедневный опрос">
        <div className={s.sky} aria-hidden="true">{Array.from({length:8},(_,i)=><CalmSparkIcon key={i}/>)}</div>
        <header className={s.header}>
          <span>Calm <CalmSparkIcon className={s.headerDot}/> каждый день</span>
          <CloseButton label="Закрыть опрос" onClick={close} disabled={busy || !!motion} />
        </header>
          <div className={s.progress}><span style={{width:`${step/totalSteps*100}%`}}/></div>
          <div className={s.step}><button title={"Назад"} disabled={!index || busy || !!motion || !!completePending || !!attackFlow || !!cycleCard} onClick={()=>{setIndex(i=>i-1)}}><ArrowBackRoundedIcon/> Назад</button><span>{step} / {totalSteps}</span></div>
          <FieldError>{toast}</FieldError>
          <div className={s.stage} data-deck>
            <div className={s.deck}>
              {afterNextCard && <div ref={backNode} key={`back-${afterNextCard}`} className={s.deckBack} data-card={afterNextCard} aria-hidden="true" inert>
                <QuestionCardFace card={afterNextCard} today={status.date} yesterday={yesterday} fields={fields} setFields={setFields} preview/>
              </div>}
              {nextCard && <div ref={middleNode} key={`next-${nextCard}`} className={s.deckMiddle} data-card={nextCard} data-next-card={nextCard} aria-hidden="true" inert>
                <QuestionCardFace card={nextCard} today={status.date} yesterday={yesterday} fields={fields} setFields={setFields} preview/>
              </div>}
              <article ref={cardNode} data-card={activeCard} aria-hidden={!!completePending} key={cycleType || card} className={`${s.card} ${motion==='bounce'?s.bounce:''} ${completePending?s.cardSaved:''}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
                {cycleCard ? <CycleQuestionCard question={cycleQuestion.question} dateChoice={cycleDateChoice} busy={busy}
                  onAnswer={answerCycle} onCancelDate={() => setCycleDateChoice(null)} />
                  : <QuestionCardFace card={card} today={status.date} yesterday={yesterday} fields={fields} setFields={setFields}/>}
                <div className={s.gestureCues} aria-hidden="true">
                  <span ref={leftCue}><ChoiceGlyph card={activeCard} side="left"/></span>
                  <span ref={rightCue}><ChoiceGlyph card={activeCard} side="right"/></span>
                </div>
                <span ref={downCue} className={s.unknownCue} aria-hidden="true"><HelpOutlineRoundedIcon/></span>
              </article>
            </div>
          </div>
          {!completePending && !cycleDateChoice && <div className={s.answerActions}>
            <button title={`Влево: ${labels[0]}`} disabled={busy || !!motion} onClick={()=>choose('left')} aria-label={`Влево: ${labels[0]}`}><ChoiceGlyph card={activeCard} side="left"/>{labels[0]}</button>
            <button title={`Вправо: ${labels[1]}`} disabled={busy || !!motion} onClick={()=>choose('right')} aria-label={`Вправо: ${labels[1]}`}>{labels[1]}<ChoiceGlyph card={activeCard} side="right"/></button>
            <button type="button" className={s.answerUnknown} disabled={busy || !!motion} onClick={()=>choose('down')}>
              <HelpOutlineRoundedIcon aria-hidden="true" />
              {cycleCard ? 'Пропустить' : 'Не знаю'}
            </button>
          </div>}
          {cycleCard && !cycleDateChoice && <CycleQuestionOptions type={cycleType} busy={busy || !!motion}
            onPickDate={setCycleDateChoice} onAnswer={answerCycle} />}
          {completePending && !busy && <><button title={"Повторить сохранение"} className={s.primary} onClick={()=>submit(completePending)}>Повторить сохранение</button><button title={"Вернуться к ответам"} className={s.subtle} onClick={()=>{setCompletePending(null)}}>Вернуться к ответам</button></>}
          {busy && <p role="status" className={s.saving}>Сохраняем…</p>}
      </div>
      <AddAttackForm open={attack.open} form={attack.form} error={attackError || attack.error}
        loading={attack.loading} deleting={attack.deleting} editing={!!attack.editingId}
        title={attackFlow==='yesterday' ? 'Приступ вчера' : 'Приступ сегодня'}
        onClose={closeAttack} setField={(field,value)=>{setAttackError('');attack.setField(field,value)}} toggleArrayField={attack.toggleArrayField}
        onSubmit={()=>saveAttack()} onSubmitAnother={attackFlow ? ()=>saveAttack(true) : undefined} onDelete={attack.remove}/>
    </div>, document.body
  )
}
