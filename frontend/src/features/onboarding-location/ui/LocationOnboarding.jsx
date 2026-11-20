import { useEffect, useState } from 'react'

import { Input } from '@/shared/ui/Input'
import { Button } from '@/shared/ui/Button'
import { CloseIcon, LocationOnIcon, SearchIcon } from '@/shared/ui/icons'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import { useLocationOnboarding } from '../model/useLocationOnboarding'

import s from './LocationOnboarding.module.scss'

const CityPicker = ({ onClose, setUser, currentCity }) => {
	const {
		results, resultQuery, searching, saving, geoLocating,
		search, useGeolocation: locateByBrowser, save,
	} = useLocationOnboarding({ setUser })

	const [draft, setDraft] = useState('')
	const [selectedCity, setSelectedCity] = useState(null)
	useBodyScrollLock(true)
	const showResults = !selectedCity && draft.trim().length >= 2 && draft.trim() === resultQuery

	// debounce поиска
	useEffect(() => {
		if (selectedCity) return
		const id = setTimeout(() => search(draft), 350)
		return () => clearTimeout(id)
	}, [draft, selectedCity, search])

	const handlePick = city => {
		setSelectedCity(city)
		setDraft([city.name, city.country].filter(Boolean).join(', '))
	}

	const handleGeo = async () => {
		try { handlePick(await locateByBrowser()) }
		catch { /* The location hook reports the failure. */ }
	}

	const handleSave = async () => {
		if (!selectedCity || saving) return
		try {
			await save(selectedCity)
			onClose?.()
		} catch { /* Keep the selection available for retry. */ }
	}

	return (
		<>
			<div className={s.overlay} onClick={onClose} />
			<section className={`${s.modal} ${s.pickerModal}`} role="dialog" aria-modal="true" aria-labelledby="loc-onboarding-title">
				<header className={s.pickerHeader}>
					<div>
						<p className={s.eyebrow}>Местоположение</p>
						<h2 id="loc-onboarding-title" className={s.title}>Город для прогноза</h2>
					</div>
					<button type="button" className={s.closeBtn} onClick={onClose} aria-label="Закрыть" title="Закрыть выбор города.">
						<CloseIcon fontSize="small" />
					</button>
				</header>

				<div className={s.pickerContent}>
					<p className={s.subtitle}>Выберите город для прогноза погоды и оценки риска приступа.</p>
					{currentCity && <div className={s.currentCity}><span>Сейчас выбран</span><strong>{currentCity}</strong></div>}
					<button
						type="button"
						onClick={handleGeo}
						disabled={saving || geoLocating}
						title="Разрешить браузеру определить город для погодного прогноза."
						className={s.geoBtn}
					>
						{geoLocating ? <span className={s.spinner} /> : <LocationOnIcon fontSize="small" />}
						<span>{geoLocating ? 'Определяем город…' : 'Определить автоматически'}</span>
					</button>

					<div className={s.dividerRow}><span>или найдите вручную</span></div>

					<div className={s.searchWrap}>
					<Input
						id="locationSearch"
						label="Город"
						title="Введите название города, для которого нужен прогноз погоды."
						placeholder="Начните вводить название"
						value={draft}
						onChange={e => { setDraft(e.target.value); setSelectedCity(null) }}
						disabled={saving || geoLocating}
						rightElement={<SearchIcon fontSize="small" />}
					/>
					</div>

				{showResults && searching && <p className={s.hint}>Поиск...</p>}
				{showResults && !searching && results.length === 0 && (
					<p className={s.hint}>Ничего не найдено</p>
				)}

				{showResults && results.length > 0 && (
					<ul className={s.results}>
						{results.map((r, i) => (
							<li key={`${r.latitude}_${r.longitude}_${i}`}>
								<button
									type="button"
									className={s.resultBtn}
									onClick={() => handlePick(r)}
									disabled={saving}
									title={`Выбрать город «${r.name}» для прогноза.`}
								>
									<span className={s.resultName}>{r.name}</span>
									<span className={s.resultMeta}>
										{[r.admin, r.country].filter(Boolean).join(', ')}
									</span>
								</button>
							</li>
						))}
					</ul>
				)}

					{saving && <p className={s.hint}>Сохраняем город…</p>}
				</div>
				<footer className={s.pickerFooter}>
					<Button type="button" colored onClick={handleSave} disabled={!selectedCity || saving || geoLocating}>
						{saving ? 'Сохраняем…' : 'Сохранить'}
					</Button>
					<button type="button" className={s.skipBtn} onClick={onClose} disabled={saving || geoLocating}>
						{currentCity ? 'Оставить прежний город' : 'Укажу позже'}
					</button>
				</footer>
			</section>
		</>
	)
}

export default function LocationOnboarding({ open, ...props }) {
	return open ? <CityPicker {...props} /> : null
}
