import { useEffect, useState } from 'react'

import { Input } from '@/shared/ui/Input'
import { CloseIcon, LocationOnIcon, SearchIcon } from '@/shared/ui/icons'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import { useLocationOnboarding } from '../model/useLocationOnboarding'

import s from './LocationOnboarding.module.scss'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'

const LocationOnboarding = ({ open, onClose, setUser, currentCity }) => {
	const {
		results, searching, saving, geoLocating, error,
		search, useGeolocation: locateByBrowser, save,
	} = useLocationOnboarding({ setUser })

	const [draft, setDraft] = useState('')
	useBodyScrollLock(open)

	// debounce поиска
	useEffect(() => {
		if (!open) return
		const id = setTimeout(() => search(draft), 350)
		return () => clearTimeout(id)
	}, [draft, open, search])

	if (!open) return null

	const handleGeo = async () => {
		try {
			const loc = await locateByBrowser()
			await save(loc)
			onClose?.()
		} catch { /* The onboarding form shows the error from its state. */ }
	}

	const handlePick = async candidate => {
		try {
			await save({
				latitude: candidate.latitude,
				longitude: candidate.longitude,
				name: candidate.name,
				country: candidate.country,
			})
			onClose?.()
		} catch { /* The onboarding form shows the error from its state. */ }
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
					<button type="button" className={s.closeBtn} onClick={onClose} aria-label="Закрыть" data-help="Закрыть выбор города.">
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
						data-help="Разрешить браузеру определить город для погодного прогноза."
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
						data-help="Введите название города, для которого нужен прогноз погоды."
						placeholder="Начните вводить название"
						value={draft}
						onChange={e => setDraft(e.target.value)}
						rightElement={<SearchIcon fontSize="small" />}
					/>
					</div>

				{searching && <p className={s.hint}>Поиск...</p>}
				{!searching && draft.trim().length >= 2 && results.length === 0 && (
					<p className={s.hint}>Ничего не найдено</p>
				)}

				{results.length > 0 && (
					<ul className={s.results}>
						{results.map((r, i) => (
							<li key={`${r.latitude}_${r.longitude}_${i}`}>
								<button
									type="button"
									className={s.resultBtn}
									onClick={() => handlePick(r)}
									disabled={saving}
									data-help={`Выбрать город «${r.name}» для прогноза.`}
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

					<ErrorNotice message={error} title="Не удалось определить город" />
					{saving && <p className={s.hint}>Сохраняем город…</p>}
				</div>
				<footer className={s.pickerFooter}>
					<button type="button" className={s.skipBtn} onClick={onClose} disabled={saving || geoLocating}>
						{currentCity ? 'Оставить прежний город' : 'Укажу позже'}
					</button>
				</footer>
			</section>
		</>
	)
}

export default LocationOnboarding
