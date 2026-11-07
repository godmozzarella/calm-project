import { useEffect, useState } from 'react'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded'
import CheckIcon from '@mui/icons-material/Check'
import { questionnaireApi } from '@/shared/api/questionnaireApi'
import { emit, PROFILE_CHANGED } from '@/shared/lib/dataEvents'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import { isCentralError } from '@/shared/lib/isCentralError'
import { useLocationOnboarding } from '../model/useLocationOnboarding'
import s from './DiaryProfileOnboarding.module.scss'

export default function DiaryProfileOnboarding({ user, setUser, onComplete }) {
  const [step, setStep] = useState('details')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('UNSPECIFIED')
  const [trackCycle, setTrackCycle] = useState(false)
  const [cityQuery, setCityQuery] = useState(user?.city || '')
  const [selectedCity, setSelectedCity] = useState(user?.latitude != null && user?.longitude != null ? { city: user.city } : null)
  const [cityDeferred, setCityDeferred] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const { results, searching, geoLocating, error: locationError, search, useGeolocation: locateByBrowser, save: saveLocation } = useLocationOnboarding({ setUser })
  useBodyScrollLock(true)

  useEffect(() => {
    if (cityDeferred || selectedCity || cityQuery.trim().length < 2) return undefined
    const timer = window.setTimeout(() => search(cityQuery), 350)
    return () => window.clearTimeout(timer)
  }, [cityDeferred, cityQuery, selectedCity, search])

  const detectCity = async () => {
    setFormError('')
    try {
      const place = await locateByBrowser()
      setCityDeferred(false)
      setSelectedCity(place)
      setCityQuery([place.name, place.country].filter(Boolean).join(', '))
    } catch { /* The location hook displays the browser error. */ }
  }

  const saveDetails = async () => {
    if (saving) return
    const parsedAge = age.trim() === '' ? null : Number(age)
    if (parsedAge !== null && (!Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120)) {
      setFormError('Укажите возраст от 1 до 120 лет или оставьте поле пустым.')
      return
    }
    if (!selectedCity && !cityDeferred) {
      setFormError('Выберите город из списка, определите его автоматически или укажите позже.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (!cityDeferred && selectedCity?.latitude != null && selectedCity?.longitude != null) await saveLocation(selectedCity)
      await questionnaireApi.profile({ sex, age: parsedAge, trackCycle: sex === 'FEMALE' && trackCycle })
      if (cityDeferred) {
        try { localStorage.setItem(`calm:location-later:${user.id}`, '1') } catch { /* This page still respects the choice. */ }
      }
      emit(PROFILE_CHANGED)
      setStep('survey')
    } catch (error) {
      if (!isCentralError(error)) setFormError(error.message || 'Не удалось сохранить информацию')
    } finally {
      setSaving(false)
    }
  }

  const pageTitle = step === 'details' ? 'Настроим ваш дневник' : step === 'survey' ? 'Несколько карточек о вашем дне' : 'Опрос подождёт'

  return <div className={s.backdrop}>
    <section className={s.panel} role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <header className={s.header}>
        <div className={s.brand}>Calm <span aria-hidden="true">✦</span></div>
        <div className={s.progress} aria-label={step === 'details' ? 'Шаг 1 из 2' : 'Шаг 2 из 2'}>
          <span className={s.active} /><span className={step !== 'details' ? s.active : ''} />
        </div>
      </header>
      <div className={s.content}>
        <div className={s.intro}>
          <p className={s.eyebrow}>{step === 'details' ? 'Первый вход · 1 из 2' : step === 'survey' ? 'Следующий шаг · 2 из 2' : 'Готово'}</p>
          <h2 id="welcome-title">{pageTitle}</h2>
          {step === 'details' && <p>Пара ответов поможет настроить дневник. Город нужен для прогноза погоды. Всё можно изменить позже.</p>}
          {step === 'survey' && <p>Короткий опрос поможет сохранить самочувствие за сегодня. Вы можете ответить сейчас или позже.</p>}
          {step === 'skipped' && <p>Вы можете пройти опрос позже: нажмите на плашку ежедневного опроса в дневнике.</p>}
        </div>
        {step === 'details' && <div className={s.form}>
          <div className={s.field}>
            <label htmlFor="welcome-age">Возраст <span>необязательно</span></label>
            <input id="welcome-age" type="number" inputMode="numeric" min="1" max="120" placeholder="Сколько вам лет" value={age} disabled={saving}
              onChange={event => { setAge(event.target.value); setFormError('') }} />
          </div>
          <div className={s.field}>
            <label htmlFor="welcome-sex">Пол</label>
            <div className={s.selectWrap}>
              <select id="welcome-sex" value={sex} disabled={saving} onChange={event => {
                setSex(event.target.value)
                if (event.target.value !== 'FEMALE') setTrackCycle(false)
              }}>
                <option value="UNSPECIFIED">Не указывать</option><option value="FEMALE">Женский</option>
                <option value="MALE">Мужской</option><option value="OTHER">Другой</option>
              </select>
              <span aria-hidden="true">⌄</span>
            </div>
          </div>
          {sex === 'FEMALE' && <label className={s.cycleOption}>
            <input type="checkbox" checked={trackCycle} disabled={saving} onChange={event => setTrackCycle(event.target.checked)} />
            <span className={`${s.checkboxVisual} ${trackCycle ? s.checkboxChecked : ''}`} aria-hidden="true">{trackCycle && <CheckIcon />}</span>
            <span className={s.cycleText}><strong>Спрашивать о менструации?</strong><small>Добавим вопросы о начале и завершении в ежедневные карточки.</small></span>
          </label>}
          <div className={s.field}>
            {cityDeferred ? <span className={s.fieldTitle}>Город</span> : <label htmlFor="welcome-city">Город</label>}
            {cityDeferred ? <div className={s.laterCard}>
              <p>Укажете позже в профиле. До этого прогноз погоды будет недоступен.</p>
              <button type="button" onClick={() => setCityDeferred(false)}>Выбрать город сейчас</button>
            </div> : <>
              <input id="welcome-city" type="search" autoComplete="address-level2" placeholder="Начните вводить город" value={cityQuery} disabled={saving}
                onChange={event => { setCityQuery(event.target.value); setSelectedCity(null); setFormError('') }} />
              {searching && <p className={s.fieldHint} role="status">Ищем город…</p>}
              {!selectedCity && results.length > 0 && <ul className={s.results}>{results.map((place, index) => <li key={`${place.latitude}-${place.longitude}-${index}`}>
                <button type="button" onClick={() => { setSelectedCity(place); setCityQuery([place.name, place.country].filter(Boolean).join(', ')); setFormError('') }}>
                  <strong>{place.name}</strong><span>{[place.admin, place.country].filter(Boolean).join(', ')}</span>
                </button>
              </li>)}</ul>}
              {selectedCity && <p className={s.selectedCity}>Выбрано: {cityQuery}</p>}
              <button type="button" className={s.geolocate} disabled={saving || geoLocating} onClick={detectCity}>
                <MyLocationRoundedIcon fontSize="small" />{geoLocating ? 'Определяем город…' : 'Определить автоматически'}
              </button>
              <button type="button" className={s.deferCity} disabled={saving || geoLocating} onClick={() => { setCityDeferred(true); setSelectedCity(null); setFormError('') }}>Укажу город позже</button>
            </>}
          </div>
        </div>}
      </div>
      <footer className={s.footer}>
        {step === 'details' && <>
          {(formError || (!cityDeferred && locationError)) && <p role="alert" className={s.error}>{formError || locationError}</p>}
          <button type="button" className={s.primary} disabled={saving || geoLocating} onClick={saveDetails}>
            {saving ? 'Сохраняем…' : <>Подтвердить и далее <ArrowForwardRoundedIcon /></>}
          </button>
        </>}
        {step === 'survey' && <>
          <button type="button" className={s.primary} onClick={() => onComplete('survey')}>Перейти к карточкам <ArrowForwardRoundedIcon /></button>
          <button type="button" className={s.secondary} onClick={() => setStep('skipped')}>Пропустить опрос</button>
        </>}
        {step === 'skipped' && <button type="button" className={s.primary} onClick={() => onComplete('skip')}>Перейти в дневник <ArrowForwardRoundedIcon /></button>}
      </footer>
    </section>
  </div>
}
