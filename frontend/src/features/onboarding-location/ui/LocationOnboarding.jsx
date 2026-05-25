import { useEffect, useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { CloseIcon, LocationOnIcon, SearchIcon } from '@/shared/ui/icons'
import { useLocationOnboarding } from '../model/useLocationOnboarding'

import s from './LocationOnboarding.module.scss'

const LocationOnboarding = ({ open, onClose, setUser }) => {
	const {
		results, searching, saving, error,
		search, useGeolocation, save,
	} = useLocationOnboarding({ setUser })

	const [draft, setDraft] = useState('')

	// debounce поиска
	useEffect(() => {
		if (!open) return
		const id = setTimeout(() => search(draft), 350)
		return () => clearTimeout(id)
	}, [draft, open])

	if (!open) return null

	const handleGeo = async () => {
		try {
			const loc = await useGeolocation()
			await save(loc)
			onClose?.()
		} catch {}
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
		} catch {}
	}

	return (
		<>
			<div className={s.overlay} onClick={onClose} />
			<div className={s.modal} role="dialog" aria-labelledby="loc-onboarding-title">
				<button className={s.closeBtn} onClick={onClose} aria-label="Закрыть">
					<CloseIcon fontSize="small" />
				</button>

				<h2 id="loc-onboarding-title" className={s.title}>Прогноз головной боли</h2>
				<p className={s.subtitle}>
					Чтобы предупреждать о неблагоприятной погоде, нужно знать твой город.
					Можно указать вручную или разрешить браузеру определить автоматически.
				</p>

				<Button
					colored
					icon={<LocationOnIcon />}
					onClick={handleGeo}
					disabled={saving}
					className={s.geoBtn}
				>
					Определить автоматически
				</Button>

				<div className={s.dividerRow}>
					<span className={s.dividerLine} />
					<span className={s.dividerText}>или</span>
					<span className={s.dividerLine} />
				</div>

				<div className={s.searchWrap}>
					<Input
						id="locationSearch"
						label="Город"
						placeholder="Москва, Санкт-Петербург, Новосибирск..."
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

				{error && <p className={s.error}>{error}</p>}
				{saving && <p className={s.hint}>Сохраняем...</p>}

				<button type="button" className={s.skipBtn} onClick={onClose}>
					Пропустить — настрою позже
				</button>
			</div>
		</>
	)
}

export default LocationOnboarding
