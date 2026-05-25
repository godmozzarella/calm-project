import { useEffect, useState } from 'react'

import { adminApi, dictionaryApi } from '@/shared/api'
import { emit } from '@/shared/lib/dataEvents'

import s from './Tab.module.scss'

const notifyChanged = () => emit('calm:dictionaries-changed')

const DictionaryTab = ({ type, title }) => {
	const [entries, setEntries] = useState([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)

	const [value, setValue] = useState('')
	const [label, setLabel] = useState('')

	const load = () => {
		setLoading(true)
		setError(null)
		dictionaryApi.getByType(type)
			.then(setEntries)
			.catch(e => setError(e.message))
			.finally(() => setLoading(false))
	}

	useEffect(() => { load() }, [type])

	const handleAdd = async e => {
		e.preventDefault()
		if (!value.trim() || !label.trim()) return
		try {
			const created = await adminApi.createEntry({
				type,
				value: value.trim(),
				label: label.trim(),
			})
			setEntries(prev => [...prev, created].sort((a, b) => a.order - b.order))
			setValue('')
			setLabel('')
			notifyChanged()
		} catch (e) {
			alert(e.message)
		}
	}

	const handleRename = async (entry, newLabel) => {
		if (!newLabel || newLabel === entry.label) return
		try {
			const updated = await adminApi.updateEntry(entry.id, { label: newLabel })
			setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
			notifyChanged()
		} catch (e) {
			alert(e.message)
		}
	}

	const handleDelete = async entry => {
		if (!window.confirm(`Удалить «${entry.label}»?`)) return
		try {
			await adminApi.deleteEntry(entry.id)
			setEntries(prev => prev.filter(e => e.id !== entry.id))
			notifyChanged()
		} catch (e) {
			alert(e.message)
		}
	}

	return (
		<div className={s.wrap}>
			<h2 className={s.h2}>{title}</h2>

			<form className={s.toolbar} onSubmit={handleAdd}>
				<input
					type="text"
					value={value}
					onChange={e => setValue(e.target.value)}
					placeholder="value (латиница)"
					className={s.input}
					pattern="[a-z][a-z0-9_]*"
					title="Только латинские буквы в нижнем регистре, цифры и подчёркивание"
				/>
				<input
					type="text"
					value={label}
					onChange={e => setLabel(e.target.value)}
					placeholder="Название по-русски"
					className={s.input}
				/>
				<button type="submit" className={s.btn}>+ Добавить</button>
			</form>

			{error && <p className={s.error}>{error}</p>}
			{loading && <p className={s.muted}>Загрузка…</p>}

			{!loading && !error && (
				<table className={s.table}>
					<thead>
						<tr>
							<th>value</th>
							<th>Название</th>
							<th>Порядок</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{entries.map(e => (
							<tr key={e.id}>
								<td><code className={s.code}>{e.value}</code></td>
								<td>
									<EditableCell value={e.label} onSave={v => handleRename(e, v)} />
								</td>
								<td className={s.muted}>{e.order}</td>
								<td>
									<button
										type="button"
										className={s.btnDanger}
										onClick={() => handleDelete(e)}
									>
										Удалить
									</button>
								</td>
							</tr>
						))}
						{entries.length === 0 && (
							<tr><td colSpan={4} className={s.muted}>Пусто</td></tr>
						)}
					</tbody>
				</table>
			)}
		</div>
	)
}

const EditableCell = ({ value, onSave }) => {
	const [editing, setEditing] = useState(false)
	const [v, setV] = useState(value)

	useEffect(() => { setV(value) }, [value])

	if (!editing) {
		return <span className={s.editable} onDoubleClick={() => setEditing(true)}>{value}</span>
	}

	const save = () => {
		setEditing(false)
		if (v.trim() && v.trim() !== value) onSave(v.trim())
		else setV(value)
	}

	return (
		<input
			type="text"
			value={v}
			onChange={e => setV(e.target.value)}
			onBlur={save}
			onKeyDown={e => {
				if (e.key === 'Enter') save()
				if (e.key === 'Escape') { setV(value); setEditing(false) }
			}}
			autoFocus
			className={s.inputInline}
		/>
	)
}

export default DictionaryTab
