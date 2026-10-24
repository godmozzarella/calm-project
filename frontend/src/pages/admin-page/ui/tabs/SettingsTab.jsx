import { useEffect, useState } from 'react'

import { adminApi } from '@/shared/api'

import s from './Tab.module.scss'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'

const SettingsTab = () => {
	const [data, setData] = useState(null)
	const [draft, setDraft] = useState(null)
	const [loading, setLoading] = useState(false)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState(null)
	const [savedAt, setSavedAt] = useState(null)

	useEffect(() => {
		setLoading(true)
		adminApi.getSettings()
			.then(d => { setData(d); setDraft(d) })
			.catch(e => setError(e.message))
			.finally(() => setLoading(false))
	}, [])

	const dirty = draft && data && draft.activeProvider !== data.activeProvider

	const handleSave = async () => {
		setSaving(true)
		setError(null)
		try {
			const updated = await adminApi.updateSettings({ activeProvider: draft.activeProvider })
			setData(updated)
			setDraft(updated)
			setSavedAt(Date.now())
		} catch (e) {
			setError(e.message)
		} finally {
			setSaving(false)
		}
	}

	if (loading) return <p className={s.muted}>Загрузка…</p>
	if (error && !data) return <ErrorNotice message={error} title="Не удалось загрузить настройки" />
	if (!draft) return null

	return (
		<div className={s.wrap}>
			<h2 className={s.h2}>Системные настройки</h2>

			<label className={s.fieldInline}>
				<span>Поставщик прогноза погоды</span>
				<select
					className={s.inputNarrow}
					value={draft.activeProvider}
					onChange={e => setDraft({ ...draft, activeProvider: e.target.value })}
				>
					{draft.availableProviders.map(p => (
						<option key={p} value={p}>{p}</option>
					))}
				</select>
				<button
					type="button"
					className={s.btn}
					onClick={handleSave}
					disabled={!dirty || saving}
				>
					{saving ? '…' : 'Сохранить'}
				</button>
				{!dirty && savedAt && <span className={s.muted}>Сохранено</span>}
			</label>

			<ErrorNotice message={error} title="Не удалось сохранить настройки" />
		</div>
	)
}

export default SettingsTab
