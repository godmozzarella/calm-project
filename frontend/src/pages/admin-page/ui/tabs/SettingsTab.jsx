import { useCallback, useEffect, useState } from 'react'

import { Input } from '@/shared/ui/Input'
import { adminApi } from '@/shared/api'
import { notifyRequestError } from '@/shared/lib/notifyError'

import s from './Tab.module.scss'

const SettingsTab = () => {
	const [data, setData] = useState(null)
	const [draft, setDraft] = useState(null)
	const [loading, setLoading] = useState(false)
	const [saving, setSaving] = useState(false)
	const [savedAt, setSavedAt] = useState(null)

	const load = useCallback(() => {
		setLoading(true)
		adminApi.getSettings()
			.then(d => { setData(d); setDraft(d) })
			.catch(e => notifyRequestError(e, 'Не удалось загрузить настройки'))
			.finally(() => setLoading(false))
	}, [])

	useEffect(() => { load() }, [load])

	const dirty = draft && data && draft.activeProvider !== data.activeProvider

	const handleSave = async () => {
		setSaving(true)
		try {
			const updated = await adminApi.updateSettings({ activeProvider: draft.activeProvider })
			setData(updated)
			setDraft(updated)
			setSavedAt(Date.now())
		} catch (e) {
			notifyRequestError(e, 'Не удалось сохранить настройки')
		} finally {
			setSaving(false)
		}
	}

	if (loading) return <p className={s.muted}>Загрузка…</p>
	if (!draft) return <button title={"Повторить загрузку"} type="button" className={s.btnSmall} onClick={load}>Повторить загрузку</button>

	return (
		<div className={s.wrap}>
			<h2 className={s.h2}>Системные настройки</h2>

			<div className={s.fieldInline}>
				<Input as="select" label="Поставщик прогноза погоды" wrapperClassName={s.toolbarField}
					value={draft.activeProvider}
					onChange={e => setDraft({ ...draft, activeProvider: e.target.value })}
				>
					{draft.availableProviders.map(p => (
						<option key={p} value={p}>{p}</option>
					))}
				</Input>
				<button
					type="button"
					className={s.btn}
					onClick={handleSave}
					disabled={!dirty || saving}
				>
					{saving ? '…' : 'Сохранить'}
				</button>
				{!dirty && savedAt && <span className={s.muted}>Сохранено</span>}
			</div>

		</div>
	)
}

export default SettingsTab
