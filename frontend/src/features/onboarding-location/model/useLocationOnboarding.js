import { useState } from 'react'

import { userApi, forecastApi } from '@/shared/api'
import { setCurrentUser } from '@/entities/user'

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
	const [query, setQuery] = useState('')
	const [results, setResults] = useState([])
	const [searching, setSearching] = useState(false)
	const [saving, setSaving] = useState(false)
	const [geoLocating, setGeoLocating] = useState(false)
	const [error, setError] = useState(null)

	const search = async q => {
		setError(null)
		const trimmed = q.trim()
		if (trimmed.length < 2) {
			setResults([])
			return
		}
		setSearching(true)
		try {
			const list = await forecastApi.geocode(trimmed, 6)
			setResults(Array.isArray(list) ? list : [])
		} catch (e) {
			setError(e.message || 'Не удалось найти город')
			setResults([])
		} finally {
			setSearching(false)
		}
	}

	const useGeolocation = () => new Promise((resolve, reject) => {
		setError(null)
		if (!('geolocation' in navigator)) {
			setError('Геолокация недоступна в этом браузере')
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
					? { name: place.name, latitude, longitude, country: place.country }
					: { name: 'Моё местоположение', latitude, longitude, country: null }
				setGeoLocating(false)
				resolve(picked)
			},
			err => {
				setGeoLocating(false)
				const msg = err.code === err.PERMISSION_DENIED
					? 'Доступ к геолокации отклонён. Выбери город вручную.'
					: 'Не удалось получить геолокацию. Выбери город вручную.'
				setError(msg)
				reject(err)
			},
			{ timeout: 8000, maximumAge: 60000 }
		)
	})

	const save = async ({ latitude, longitude, name, country }) => {
		setSaving(true)
		setError(null)
		try {
			const cityLabel = country && name ? `${name}, ${country}` : (name || 'Моё местоположение')
			const updated = await userApi.updateMe({
				latitude,
				longitude,
				city: cityLabel,
				notificationsEnabled: true,
			})
			setCurrentUser(updated)
			setUser(updated)
			return updated
		} catch (e) {
			setError(e.message || 'Не удалось сохранить локацию')
			throw e
		} finally {
			setSaving(false)
		}
	}

	return {
		query, setQuery,
		results,
		searching,
		saving,
		geoLocating,
		error,
		search,
		useGeolocation,
		save,
	}
}
