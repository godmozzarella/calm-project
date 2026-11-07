import { useEffect, useRef, useState } from 'react'
import { forecastApi, userApi } from '@/shared/api'
import { getCurrentUser, setCurrentUser } from '@/entities/user'
import { Button } from '@/shared/ui/Button'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'
import { shouldSuggestLocation } from '../model/locationPolicy'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import { isCentralError } from '@/shared/lib/isCentralError'
import s from './LocationOnboarding.module.scss'

const CHECK_INTERVAL = 6 * 60 * 60 * 1000

export default function AutoLocationCheck({ user, setUser }) {
    const [candidate, setCandidate] = useState(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const declineButton = useRef(null)
    useBodyScrollLock(Boolean(candidate && user?.locationMode === 'AUTO' && candidate.version === (user.locationVersion ?? 0)))
    useEffect(() => {
        if (!user?.id || user.locationMode !== 'AUTO' || !navigator.geolocation) return undefined
        let active = true
        let checking = false
        const check = () => {
            if (!active || checking || document.hidden) return
            const current = getCurrentUser()
            if (current?.id !== user.id || current.locationMode !== 'AUTO') return
            const key = `calm-location-check:${current.id}`
            if (Date.now() - Number(sessionStorage.getItem(key) || 0) < CHECK_INTERVAL) return
            checking = true
            sessionStorage.setItem(key, String(Date.now()))
            navigator.geolocation.getCurrentPosition(async position => {
                try {
                    const { latitude, longitude } = position.coords
                    const place = await forecastApi.reverseGeocode({ lat: latitude, lon: longitude })
                    const latest = getCurrentUser()
                    if (!active || !place?.name || latest?.locationMode !== 'AUTO' || latest.locationVersion !== current.locationVersion) return
                    const city = [place.name, place.country].filter(Boolean).join(', ')
                    if (shouldSuggestLocation(current, { latitude, longitude, city })) {
                        setCandidate({ latitude, longitude, city, version: current.locationVersion ?? 0 })
                        setError('')
                    }
                } catch { /* Keep the last confirmed city when GPS/geocoding is unavailable. */ }
                finally { checking = false }
            }, () => { checking = false }, { timeout: 8000, maximumAge: 60000 })
        }
        check()
        const timer = window.setInterval(check, 30 * 60 * 1000)
        window.addEventListener('focus', check)
        document.addEventListener('visibilitychange', check)
        return () => {
            active = false
            window.clearInterval(timer)
            window.removeEventListener('focus', check)
            document.removeEventListener('visibilitychange', check)
        }
    }, [user?.id, user?.locationMode, user?.locationVersion])

    useEffect(() => {
        if (!candidate || user?.locationMode !== 'AUTO' || candidate.version !== (user.locationVersion ?? 0)) return undefined
        const previous = document.activeElement
        declineButton.current?.focus()
        const onKey = event => { if (event.key === 'Escape' && !saving) setCandidate(null) }
        document.addEventListener('keydown', onKey)
        return () => { document.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus() }
    }, [candidate, user?.locationMode, user?.locationVersion, saving])

    const confirm = async () => {
        if (saving) return
        setSaving(true)
        setError('')
        try {
            const updated = await userApi.updateMe({ latitude: candidate.latitude, longitude: candidate.longitude,
                city: candidate.city, locationMode: 'AUTO', locationTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                expectedLocationVersion: candidate.version, automaticLocationUpdate: true })
            setCurrentUser(updated)
            setUser(updated)
            setCandidate(null)
        } catch (e) { if (!isCentralError(e)) setError(e.message || 'Не удалось сохранить город') }
        finally { setSaving(false) }
    }
    if (!candidate || user?.locationMode !== 'AUTO' || candidate.version !== (user.locationVersion ?? 0)) return null
    return <>
        <div className={s.overlay} onClick={() => { if (!saving) setCandidate(null) }} />
        <section className={s.modal} role="dialog" aria-modal="true" aria-labelledby="location-change-title">
            <h2 id="location-change-title" className={s.title}>Вы находитесь здесь?</h2>
            <p className={s.subtitle}>{candidate.city}</p>
            <p className={s.subtitle}>Обновить город для погоды и новых записей? Сейчас выбран: {user.city}.</p>
            <ErrorNotice message={error} />
            <Button colored onClick={confirm} disabled={saving}>Да, обновить город</Button>
            <button ref={declineButton} className={s.skipBtn} disabled={saving} onClick={() => setCandidate(null)}>Нет, оставить {user.city}</button>
        </section>
    </>
}
