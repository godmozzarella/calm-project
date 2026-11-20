import { useCallback, useRef, useState } from 'react'

import { userApi, forecastApi } from '@/shared/api'
import { getCurrentUser, setCurrentUser } from '@/entities/user'
import { notifyError, notifyRequestError } from '@/shared/lib/notifyError'

/**
 * Хук онбординга локации: поиск города (через бэк) + геолокация браузера +
 * сохранение выбранной точки в профиль.
 *
 * Контракт:
 * - results       — кандидаты геокодинга
 * - search(q)     — дёргает /forecast/geocode
 * - useGeolocation() — спрашивает navigator.geolocation, reverse-геокодит через бэк
 * - save(loc)     — PATCH /users/me с lat/lon/city, обновляет локальный user через setUser
 */
export const useLocationOnboarding = ({ setUser }) => {
	const searchVersion = useRef(0)
	const [resultQuery, setResultQuery] = useState('')
	const [results, setResults] = useState([])
	const [searching, setSearching] = useState(false)
	const [saving, setSaving] = useState(false)
	const [geoLocating, setGeoLocating] = useState(false)

	const search = useCallback(async q => {
		const version = ++searchVersion.current
		const trimmed = q.trim()
		setResultQuery(trimmed)
		setResults([])
		if (trimmed.length < 2) { setSearching(false); return }
		setSearching(true)
		try {
			const list = await forecastApi.geocode(trimmed, 6)
			if (version === searchVersion.current) setResults(Array.isArray(list) ? list : [])
		} catch (e) {
			if (version === searchVersion.current) notifyRequestError(e, 'Не удалось найти город')
		} finally {
			if (version === searchVersion.current) setSearching(false)
		}
	}, [])

	const useGeolocation = () => new Promise((resolve, reject) => {
		if (!('geolocation' in navigator)) {
			notifyError('Выберите город вручную.', 'Геолокация недоступна в этом браузере')
			reject(new Error('no-geolocation'))
			return
		}
		setGeoLocating(true)
		navigator.geolocation.getCurrentPosition(
			async pos => {
				const { latitude, longitude } = pos.coords
				// Reverse geocode через бэк → Nominatim. Если не отвечает — показываем
				// безликий «Моё местоположение», но lat/lon всё равно сохраняются и прогноз работает.
				const place = await forecastApi.reverseGeocode({ lat: latitude, lon: longitude }).catch(() => null)
				const picked = place
					? { name: place.name, latitude, longitude, country: place.country, locationMode: 'AUTO' }
					: { name: 'Моё местоположение', latitude, longitude, country: null, locationMode: 'AUTO' }
				setGeoLocating(false)
				resolve(picked)
			},
			err => {
				setGeoLocating(false)
				const msg = err.code === err.PERMISSION_DENIED
					? 'Доступ к геолокации отклонён. Выбери город вручную.'
					: 'Не удалось получить геолокацию. Выбери город вручную.'
				notifyError(msg, 'Не удалось определить местоположение')
				reject(err)
			},
			{ timeout: 8000, maximumAge: 60000 }
		)
	})

	const save = async ({ latitude, longitude, name, country, locationMode = 'MANUAL' }) => {
		setSaving(true)
		try {
			const cityLabel = country && name ? `${name}, ${country}` : (name || 'Моё местоположение')
			const updated = await userApi.updateMe({
				latitude,
				longitude,
				city: cityLabel,
                locationMode, locationTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                expectedLocationVersion: getCurrentUser()?.locationVersion ?? 0,
			})
			setCurrentUser(updated)
			setUser(updated)
			return updated
		} catch (e) {
			notifyRequestError(e, 'Не удалось сохранить город')
			throw e
		} finally {
			setSaving(false)
		}
	}

	return {
		resultQuery,
		results,
		searching,
		saving,
		geoLocating,
		search,
		useGeolocation,
		save,
	}
}
