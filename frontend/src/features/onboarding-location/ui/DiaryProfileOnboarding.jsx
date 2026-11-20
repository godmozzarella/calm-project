import { useEffect, useState } from 'react'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded'
import { Input } from '@/shared/ui/Input'
import { userApi } from '@/shared/api'
import { setCurrentUser } from '@/entities/user'
import { questionnaireApi } from '@/shared/api/questionnaireApi'
import { emit, PROFILE_CHANGED } from '@/shared/lib/dataEvents'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import { notifyRequestError } from '@/shared/lib/notifyError'
import { useLocationOnboarding } from '../model/useLocationOnboarding'
import s from './DiaryProfileOnboarding.module.scss'

export default function DiaryProfileOnboarding({ user, setUser, onProfileSaved, onComplete }) {
  const [step, setStep] = useState('details')
  const [nickname, setNickname] = useState(user?.name || '')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('UNSPECIFIED')
  const [trackCycle, setTrackCycle] = useState(false)
  const [cityQuery, setCityQuery] = useState(user?.city || '')
  const [selectedCity, setSelectedCity] = useState(user?.latitude != null && user?.longitude != null ? { city: user.city } : null)
  const [cityDeferred, setCityDeferred] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const { results, resultQuery, searching, geoLocating, search, useGeolocation: locateByBrowser, save: saveLocation } = useLocationOnboarding({ setUser })
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
    const name = nickname.trim()
    if (name.length > 64) {
      setFormError({ field: 'nickname', message: 'Никнейм должен быть не длиннее 64 символов.' })
      return
    }
    const parsedAge = age.trim() === '' ? null : Number(age)
    if (parsedAge !== null && (!Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120)) {
      setFormError({ field: 'age', message: 'Укажите возраст от 1 до 120 лет или оставьте поле пустым.' })
      return
    }
    if (!selectedCity && !cityDeferred) {
      setFormError({ field: 'city', message: 'Выберите город из списка, определите его автоматически или укажите позже.' })
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (!cityDeferred && selectedCity?.latitude != null && selectedCity?.longitude != null) await saveLocation(selectedCity)
      if (name && name !== user?.name) {
        const updated = await userApi.updateMe({ name })
        setCurrentUser(updated)
        setUser(updated)
      }
      await questionnaireApi.profile({ sex, age: parsedAge, trackCycle: sex === 'FEMALE' && trackCycle })
      if (cityDeferred) {
        try { localStorage.setItem(`calm:location-later:${user.id}`, '1') } catch { /* This page still respects the choice. */ }
      }
      emit(PROFILE_CHANGED)
      onProfileSaved()
      setStep('done')
    } catch (error) {
      notifyRequestError(error, 'Не удалось сохранить информацию')
    } finally {
      setSaving(false)
    }
  }

  const pageTitle = step === 'details' ? 'Настроим ваш дневник' : 'Дневник настроен'

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
          <p className={s.eyebrow}>{step === 'details' ? 'Первый вход · 1 из 2' : 'Готово'}</p>
          <h2 id="welcome-title">{pageTitle}</h2>
          {step === 'details' && <p>Пара ответов поможет настроить дневник. Город нужен для прогноза погоды. Всё можно изменить позже.</p>}
          {step === 'done' && <p>Чтобы открыть ежедневные карточки, нажмите на звезду серии рядом с датой.</p>}
        </div>
        {step === 'details' && <div className={s.form}>
          <Input id="welcome-nickname" autoComplete="nickname" label="Отображаемый никнейм" maxLength={64}
            value={nickname} disabled={saving} error={formError?.field === 'nickname' ? formError.message : undefined}
            onChange={event => { setNickname(event.target.value); setFormError('') }} />
          <Input id="welcome-age" type="number" inputMode="numeric" min="1" max="120" label="Возраст" hint="Можно не указывать"
            value={age} disabled={saving} error={formError?.field === 'age' ? formError.message : undefined}
            onChange={event => { setAge(event.target.value); setFormError('') }} />
          <Input as="select" id="welcome-sex" label="Пол" value={sex} disabled={saving} onChange={event => {
            setSex(event.target.value)
            if (event.target.value !== 'FEMALE') setTrackCycle(false)
          }}>
            <option value="UNSPECIFIED">Не указывать</option>
            <option value="FEMALE">Женский</option>
            <option value="MALE">Мужской</option>
          </Input>
          {sex === 'FEMALE' && <label className={s.cycleOption} title="Вопросы о менструации">
            <span className={s.cycleText}><strong>Спрашивать о менструации?</strong><small>Добавим вопросы о начале и завершении в ежедневные карточки.</small></span>
            <input type="checkbox" checked={trackCycle} disabled={saving} onChange={event => setTrackCycle(event.target.checked)} />
          </label>}
          <div className={s.field}>
            {cityDeferred && <span className={s.fieldTitle}>Город</span>}
            {cityDeferred ? <div className={s.laterCard}>
              <p>Укажете позже в профиле. До этого прогноз погоды будет недоступен.</p>
              <button title={"Выбрать город сейчас"} type="button" onClick={() => setCityDeferred(false)}>Выбрать город сейчас</button>
            </div> : <>
              <Input id="welcome-city" type="search" autoComplete="address-level2" label="Город" value={cityQuery} disabled={saving || geoLocating}
                error={formError?.field === 'city' ? formError.message : undefined}
                onChange={event => { setCityQuery(event.target.value); setSelectedCity(null); setFormError('') }} />
              {!selectedCity && searching && resultQuery === cityQuery.trim() && <p className={s.fieldHint} role="status">Ищем город…</p>}
              {!selectedCity && resultQuery === cityQuery.trim() && results.length > 0 && <ul className={s.results}>{results.map((place, index) => <li key={`${place.latitude}-${place.longitude}-${index}`}>
                <button type="button" onClick={() => { setSelectedCity(place); setCityQuery([place.name, place.country].filter(Boolean).join(', ')); setFormError('') }}>
                  <strong>{place.name}</strong><span>{[place.admin, place.country].filter(Boolean).join(', ')}</span>
                </button>
              </li>)}</ul>}
              {selectedCity && <p className={s.selectedCity}>Выбрано: {cityQuery}</p>}
              <button type="button" className={s.geolocate} disabled={saving || geoLocating} onClick={detectCity}>
                <MyLocationRoundedIcon fontSize="small" />{geoLocating ? 'Определяем город…' : 'Определить автоматически'}
              </button>
              <button title={"Укажу город позже"} type="button" className={s.deferCity} disabled={saving || geoLocating} onClick={() => { setCityDeferred(true); setSelectedCity(null); setFormError('') }}>Укажу город позже</button>
            </>}
          </div>
        </div>}
      </div>
      <footer className={s.footer}>
        {step === 'details' && <>
          <button type="button" className={s.primary} disabled={saving || geoLocating} onClick={saveDetails}>
            {saving ? 'Сохраняем…' : <>Подтвердить и далее <ArrowForwardRoundedIcon /></>}
          </button>
        </>}
        {step === 'done' && <button type="button" className={s.primary} onClick={onComplete}>Перейти в дневник <ArrowForwardRoundedIcon /></button>}
      </footer>
    </section>
  </div>
}
