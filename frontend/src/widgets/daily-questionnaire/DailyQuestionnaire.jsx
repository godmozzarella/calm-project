import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { questionnaireApi, browserTimezone } from '@/shared/api/questionnaireApi'
import { attackApi } from '@/shared/api'
import { useAddAttack, AddAttackForm } from '@/features/add-attack'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import { isCentralError } from '@/shared/lib/isCentralError'
import { emit, subscribe, PROFILE_CHANGED, SURVEY_COMPLETED, SURVEY_CLOSED, OPEN_DAILY_QUESTIONNAIRE } from '@/shared/lib/dataEvents'
import { cardsFor, swipeDirection, answerFor, emptyAnswers, actionLabels } from './cards.mjs'
import QuestionCardFace from './QuestionCardFace'
import { ArrowBackRoundedIcon, CalmSparkIcon, CloseIcon } from '@/shared/ui/icons'
import StyleIcon from '@mui/icons-material/Style'
import TouchAppOutlinedIcon from '@mui/icons-material/TouchAppOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import s from './Questionnaire.module.scss'

const dateLabel = key => new Date(`${key}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
const previousDate = key => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const ChoiceGlyph = ({card,side}) => side==='left' ? ['quality','stress'].includes(card) ? <SaveRoundedIcon aria-hidden="true"/> : <CloseRoundedIcon aria-hidden="true"/> : ['quality','stress','sleep'].includes(card) ? <SaveRoundedIcon aria-hidden="true"/> : <CheckRoundedIcon aria-hidden="true"/>

export default function DailyQuestionnaire({ userId, onInitialReady, autoOpenAllowed = false }) {
  const [status,setStatus] = useState(null)
  const [open,setOpen] = useState(false)
  const [answers,setAnswers] = useState(emptyAnswers)
  const [fields,setFields] = useState({ hours:'', minutes:'', sleepTouched:false, sleepQuality:null, stress:null, cycleStart:'', cycleDay:'', cycleMonth:'' })
  const [index,setIndex] = useState(0)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [toast,setToast] = useState('')
  const [motion,setMotion] = useState('')
  const [attackFlow,setAttackFlow] = useState(null)
  const [attackError,setAttackError] = useState('')
  const attackSession = useRef(null)
  const [completePending,setCompletePending] = useState(null)
  const pointer = useRef(null), dragFrame = useRef(null), cardNode = useRef(null)
  const middleNode = useRef(null), backNode = useRef(null)
  const leftCue = useRef(null), rightCue = useRef(null), downCue = useRef(null)
  const pending = useRef(false), timers = useRef([]), dialog = useRef(null), opener = useRef(null)
  const autoStartedDate = useRef(null)
  const draftKey = status ? `calm:survey-draft:${userId}:${status.date}` : null
  const later = (fn, ms) => { const t=window.setTimeout(fn,ms); timers.current.push(t); return t }
  useEffect(() => () => { timers.current.forEach(window.clearTimeout); if(dragFrame.current) window.cancelAnimationFrame(dragFrame.current) }, [])
  const reload = useCallback(async () => {
    setError('')
    try { setStatus(await questionnaireApi.status()); setError('') } catch(e) { if(!isCentralError(e)) setError(e.message || 'Не удалось загрузить опрос') }
    finally { onInitialReady?.('outcome') }
  }, [onInitialReady])
  useEffect(() => { reload() }, [reload])
  useEffect(() => subscribe(PROFILE_CHANGED,reload),[reload])
  useBodyScrollLock(open)
  useEffect(() => {
    if (!open) return
    const root=document.getElementById('root'), wasInert=root?.inert
    if(root) root.inert=true
    const previous=document.activeElement
    dialog.current?.querySelector('button, select, input')?.focus()
    const trap=e => {
      if(e.key!=='Tab') return
      const scope=dialog.current?.querySelector('[data-attack-form]') || dialog.current
      const focusable=[...scope?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)') || []].filter(el => el.getClientRects().length)
      if(!focusable.length) { e.preventDefault(); return }
      const first=focusable[0], last=focusable.at(-1)
      if(e.shiftKey && document.activeElement===first) { e.preventDefault(); last.focus() }
      if(!e.shiftKey && document.activeElement===last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown',trap)
    return () => { if(root) root.inert=wasInert; window.removeEventListener('keydown',trap); previous?.focus({ preventScroll:true }) }
  }, [open])
  useEffect(() => {
    if(!open || !draftKey) return
    try { sessionStorage.setItem(draftKey,JSON.stringify({version:2,answers,fields,index})) } catch { /* Draft is optional. */ }
  }, [open,draftKey,answers,fields,index])
  const cards=cardsFor(answers,status?.profile?.trackCycle,status?.askCycle,status?.askCycleEnd), card=cards[index]
  const yesterday=status ? previousDate(status.date):''
  const sleepTouched = Boolean(fields.sleepTouched || fields.hours != null && fields.hours!=='' || fields.minutes != null && fields.minutes!=='' || answers.sleepMinutes>0)
  const previewSleep = card==='sleep' && motion && motion!=='bounce' ? answers.sleepMinutes : sleepTouched ? 1 : 0
  const previewCards = card==='sleep' ? cardsFor({...answers,sleepMinutes:previewSleep},status?.profile?.trackCycle,status?.askCycle,status?.askCycleEnd) : cards
  const nextCard = previewCards[index+1]
  const afterNextCard = previewCards[index+2]
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
    setError('')
    try {
      const fresh=await questionnaireApi.status(); setStatus(fresh)
      const saved=fresh.today?.answers
      let draft=null
      try { draft=JSON.parse(sessionStorage.getItem(`calm:survey-draft:${userId}:${fresh.date}`)||'null') } catch { /* Ignore old drafts. */ }
      const a={...emptyAnswers(),...(draft?.answers || saved || {})}
      a.ongoing ??= 'UNKNOWN'
      if(!fresh.profile?.trackCycle || fresh.profile?.sex!=='FEMALE') { a.menstruating=null; a.cycleStart=null; a.cycleEnded=null }
      if(fresh.askCycleEnd) { a.menstruating=null; a.cycleStart=null }
      if(fresh.askCycle) a.cycleEnded=null
      if(!fresh.askCycleEnd && a.cycleEnded!=='YES') a.cycleEnded=null
      if(fresh.askCycleEnd && saved?.cycleEnded==='YES') a.cycleEnded=null
      if(saved?.menstruating==='YES' && !fresh.cycleTodayMarked) { a.menstruating=null; a.cycleStart=null }
      if(a.menstruating==='YES' && a.cycleStart!==fresh.date) { a.menstruating=null; a.cycleStart=null }
      const savedFields = draft?.fields || { hours:a.sleepMinutes>0?Math.floor(a.sleepMinutes/60):'',minutes:a.sleepMinutes>0?a.sleepMinutes%60:'',sleepQuality:a.sleepQuality,stress:a.stress,cycleStart:a.cycleStart||'' }
      const savedIndex=Number.isInteger(draft?.index)?draft.index:0
      const resumeIndex=draft?.version===2?savedIndex:savedIndex>2?savedIndex-1:savedIndex
      setAnswers(a); setFields({...savedFields,sleepTouched:Boolean(savedFields.sleepTouched || savedFields.hours != null && savedFields.hours!=='' || savedFields.minutes != null && savedFields.minutes!=='' || a.sleepMinutes>0)}); setIndex(Math.max(0,Math.min(resumeIndex,cardsFor(a,fresh.profile?.trackCycle,fresh.askCycle,fresh.askCycleEnd).length-1)))
      setError(''); setOpen(true); setCompletePending(null)
      if (!fresh.today) {
        try { localStorage.setItem(`calm:survey-auto-opened:${userId}`, fresh.date) } catch { /* Browser storage may be unavailable. */ }
      }
      return fresh.date
    } catch(e) { if(!isCentralError(e)) setError(e.message); return null }
  }, [userId])
  useEffect(() => subscribe(OPEN_DAILY_QUESTIONNAIRE, start), [start])
  useEffect(() => {
    if (!autoOpenAllowed || !userId || !status?.date || status.today || open) return
    const key = `calm:survey-auto-opened:${userId}`
    try { if (localStorage.getItem(key) === status.date) return } catch { /* Continue without persistence. */ }
    if (autoStartedDate.current === status.date) return
    autoStartedDate.current = status.date
    start().then(openedDate => { if (!openedDate) autoStartedDate.current = null })
  }, [autoOpenAllowed, userId, status?.date, status?.today, open, start])
  const close = () => { if(pending.current || motion || busy || attack.loading || attack.deleting) return; setOpen(false); emit(SURVEY_CLOSED); setAttackFlow(null); attackSession.current=null; attack.closeForm(); setMotion('') }
  const submit = async a => {
    if(pending.current) return
    pending.current=true; setBusy(true); setError(''); setCompletePending(a)
    try {
      const saved=await questionnaireApi.submit(status.date,status.today?.timezone || browserTimezone(),a)
      setStatus(prev=>({...prev,today:saved.entry,currentStreak:saved.currentStreak,askCycle:a.menstruating==='YES'?false:prev.askCycle,askCycleEnd:a.cycleEnded==='YES'?false:prev.askCycleEnd,cycleTodayMarked:a.menstruating==='YES'||prev.cycleTodayMarked}))
      setCompletePending(null)
      setOpen(false)
      later(()=>{
        opener.current?.focus({preventScroll:true})
        const target=document.querySelector('[data-streak-target]')
        const rect=target?.getBoundingClientRect()
        if(rect && (rect.top<0 || rect.bottom>window.innerHeight)) target.scrollIntoView({block:'nearest',behavior:'auto'})
        emit(SURVEY_COMPLETED,{currentStreak:saved.currentStreak,newCompletion:saved.newCompletion,completedToday:true})
      },0)
      try { sessionStorage.removeItem(draftKey) } catch { /* Storage may be unavailable. */ }
    } catch(e) { if(!isCentralError(e)) setError(e.message || 'Не удалось сохранить. Ответы остались на месте.') }
    finally { pending.current=false; setBusy(false) }
  }
  const advance = (patch, direction) => {
    const next={...answers,...patch}; setToast(''); setAnswers(next); setMotion(direction)
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
      setMotion(''); const nextCards=cardsFor(next,status.profile?.trackCycle,status.askCycle,status.askCycleEnd); if(index>=nextCards.length-1) submit(next); else setIndex(i=>i+1)
    },animated?220:0)
  }
  const choose = async direction => {
    if(busy || pending.current || motion || attackFlow || !card || completePending) return
    try {
      const patch=answerFor(card,direction,fields,status.date)
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
        } finally { setBusy(false) }
        return
      }
      advance(patch,direction)
    } catch(e) { clearDragVisual(true); if(!isCentralError(e)) notify(e.message) }
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
      setAttackError(`Укажите начало приступа за ${dateLabel(session.day)}`)
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
    if(e.target.closest('input,button,select,label,a,[data-wheel]') || busy || motion || attackFlow || completePending) return
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
  const done=status?.today
  return <>
    <section className={s.launcherSection} aria-label="Ежедневный опрос">
      <button ref={opener} type="button" className={s.launcher} onClick={start} data-help="Открыть ежедневный чекин.">
        <span className={s.launchSky} aria-hidden="true">{Array.from({length:6},(_,i)=><CalmSparkIcon key={i}/>)}</span>
        {done ? <>
          <span className={s.launchEditIcon}><StyleIcon aria-hidden="true"/></span>
          <strong>Вы сегодня позаботились о себе</strong>
          <span className={s.launchDescription}>Откройте карточки, чтобы уточнить ответы.</span>
        </> : <span className={s.launchPrompt}><TouchAppOutlinedIcon aria-hidden="true"/><strong>Нажми и позаботься о себе!</strong></span>}
      </button>
      {error && !open && <p role="alert" className={s.error}>{error} <button onClick={reload}>Повторить</button></p>}
    </section>
    {open && createPortal(<div ref={dialog} className={s.modalRoot} onKeyDown={e=>{if(e.key==='Escape' && !attack.open) close()}}>
      <div className={s.overlay} inert={attack.open} aria-hidden={attack.open || undefined} role="dialog" aria-modal="true" aria-label="Ежедневный опрос">
        <div className={s.sky} aria-hidden="true">{Array.from({length:8},(_,i)=><CalmSparkIcon key={i}/>)}</div>
        <header className={s.header}><span>Calm <CalmSparkIcon className={s.headerDot}/> каждый день</span><button onClick={close} disabled={busy || !!motion} aria-label="Закрыть опрос"><CloseIcon/></button></header>
        <>
          <div className={s.progress}><span style={{width:`${(index+1)/cards.length*100}%`}}/></div>
          <div className={s.step}><button disabled={!index || busy || !!motion || !!completePending || !!attackFlow} onClick={()=>{setIndex(i=>i-1);setError('')}}><ArrowBackRoundedIcon/> Назад</button><span>{index+1} / {cards.length}</span></div>
          <div className={s.stage} data-deck>
            <div className={s.deck}>
              {toast && <div role="alert" className={s.toast}>{toast}</div>}
              {afterNextCard && <div ref={backNode} key={`back-${afterNextCard}`} className={s.deckBack} data-card={afterNextCard} aria-hidden="true" inert>
                <QuestionCardFace card={afterNextCard} today={status.date} yesterday={yesterday} fields={fields} setFields={setFields} preview/>
              </div>}
              {nextCard && <div ref={middleNode} key={`next-${nextCard}`} className={s.deckMiddle} data-card={nextCard} data-next-card={nextCard} aria-hidden="true" inert>
                <QuestionCardFace card={nextCard} today={status.date} yesterday={yesterday} fields={fields} setFields={setFields} preview/>
              </div>}
              <article ref={cardNode} data-card={card} aria-hidden={!!completePending} key={card} className={`${s.card} ${motion==='bounce'?s.bounce:''} ${completePending?s.cardSaved:''}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
                <QuestionCardFace card={card} today={status.date} yesterday={yesterday} fields={fields} setFields={setFields}/>
                <div className={s.gestureCues} aria-hidden="true">
                  <span ref={leftCue}><ChoiceGlyph card={card} side="left"/></span>
                  <span ref={rightCue}><ChoiceGlyph card={card} side="right"/></span>
                </div>
                <span ref={downCue} className={s.unknownCue} aria-hidden="true"><HelpOutlineRoundedIcon/></span>
              </article>
            </div>
          </div>
          {!completePending && <div className={s.answerActions}>
            <button className={s.answerLeft} disabled={busy || !!motion} onClick={()=>choose('left')} aria-label={`Влево: ${actionLabels(card)[0]}`}><ChoiceGlyph card={card} side="left"/>{actionLabels(card)[0]}</button>
            <button className={s.answerRight} disabled={busy || !!motion} onClick={()=>choose('right')} aria-label={`Вправо: ${actionLabels(card)[1]}`}>{actionLabels(card)[1]}<ChoiceGlyph card={card} side="right"/></button>
            <button className={s.answerUnknown} disabled={busy || !!motion} onClick={()=>choose('down')} aria-label="Вниз: не знаю"><HelpOutlineRoundedIcon aria-hidden="true"/>Не знаю</button>
          </div>}
          {completePending && !busy && <><button className={s.primary} onClick={()=>submit(completePending)}>Повторить сохранение</button><button className={s.subtle} onClick={()=>{setCompletePending(null);setError('')}}>Вернуться к ответам</button></>}
          {busy && <p role="status" className={s.saving}>Сохраняем…</p>}
          {error && <p role="alert" className={s.error}>{error}</p>}
          <p className={s.privacy}>Каждый день — маленькая забота о себе.</p>
        </>
      </div>
      <AddAttackForm open={attack.open} form={attack.form} error={attackError || attack.error} deleteError={attack.deleteError}
        loading={attack.loading} deleting={attack.deleting} editing={!!attack.editingId}
        title={attackFlow==='yesterday' ? 'Приступ вчера' : 'Приступ сегодня'}
        onClose={closeAttack} setField={(field,value)=>{setAttackError('');attack.setField(field,value)}} toggleArrayField={attack.toggleArrayField}
        onSubmit={()=>saveAttack()} onSubmitAnother={attackFlow ? ()=>saveAttack(true) : undefined} onDelete={attack.remove}/>
    </div>,document.body)}
  </>
}
