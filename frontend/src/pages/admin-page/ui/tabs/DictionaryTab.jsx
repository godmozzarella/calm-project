import { useCallback, useEffect, useState } from 'react'
import { Input } from '@/shared/ui/Input'

import { adminApi, dictionaryApi } from '@/shared/api'
import { emit } from '@/shared/lib/dataEvents'
import { notifyRequestError } from '@/shared/lib/notifyError'

import s from './Tab.module.scss'

const notifyChanged = () => emit('calm:dictionaries-changed')

const DictionaryTab = ({ type, title, categories = null }) => {
	const [entries, setEntries] = useState([])
	const [loading, setLoading] = useState(false)
	const [loadFailed, setLoadFailed] = useState(false)

	const [value, setValue] = useState('')
	const [fieldError, setFieldError] = useState(null)
	const [label, setLabel] = useState('')
	const [category, setCategory] = useState(categories?.[0]?.value ?? '')

	const load = useCallback(() => {
		setLoading(true)
		setLoadFailed(false)
		dictionaryApi.getByType(type)
			.then(setEntries)
			.catch(e => { setLoadFailed(true); notifyRequestError(e, 'Не удалось загрузить справочник') })
			.finally(() => setLoading(false))
	}, [type])

	useEffect(() => { load() }, [load])

	const handleAdd = async e => {
		e.preventDefault()
		if (!/^[a-z][a-z0-9_]*$/.test(value.trim())) {
			setFieldError({ field: 'value', text: 'Введите код латиницей. Допустимы строчные буквы, цифры и подчёркивание.' })
			return
		}
		if (!label.trim()) { setFieldError({ field: 'label', text: 'Введите название.' }); return }
		try {
			const created = await adminApi.createEntry({
				type,
				value: value.trim(),
				label: label.trim(),
				category: categories ? (category || null) : undefined,
			})
			setEntries(prev => [...prev, created].sort((a, b) => a.order - b.order))
			setValue('')
			setLabel('')
			notifyChanged()
		} catch (e) {
			notifyRequestError(e)
		}
	}

	const handleRename = async (entry, newLabel) => {
		if (!newLabel || newLabel === entry.label) return
		try {
			const updated = await adminApi.updateEntry(entry.id, { label: newLabel })
			setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
			notifyChanged()
		} catch (e) {
			notifyRequestError(e)
		}
	}

	const handleChangeCategory = async (entry, newCat) => {
		if (newCat === (entry.category ?? '')) return
		try {
			const updated = await adminApi.updateEntry(entry.id, { category: newCat })
			setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
			notifyChanged()
		} catch (e) {
			notifyRequestError(e)
		}
	}

	const handleDelete = async entry => {
		if (!window.confirm(`Удалить «${entry.label}»?`)) return
		try {
			await adminApi.deleteEntry(entry.id)
			setEntries(prev => prev.filter(e => e.id !== entry.id))
			notifyChanged()
		} catch (e) {
			notifyRequestError(e)
		}
	}

	return (
		<div className={s.wrap}>
			<h2 className={s.h2}>{title}</h2>

			<form className={s.toolbar} onSubmit={handleAdd} noValidate>
				<Input
					type="text"
					value={value}
					onChange={e => { setValue(e.target.value); setFieldError(null) }}
					error={fieldError?.field === 'value' ? fieldError.text : undefined}
					placeholder="Код (латиницей)"
					wrapperClassName={s.toolbarField}
					pattern="[a-z][a-z0-9_]*"
					title="Только латинские буквы в нижнем регистре, цифры и подчёркивание"
				/>
				<Input
					type="text"
					value={label}
					onChange={e => { setLabel(e.target.value); setFieldError(null) }}
					error={fieldError?.field === 'label' ? fieldError.text : undefined}
					placeholder="Название по-русски"
					wrapperClassName={s.toolbarField}
				/>
				{categories && (
					<Input as="select"
						wrapperClassName={s.toolbarField} label="Категория"
						value={category}
						onChange={e => setCategory(e.target.value)}
					>
						{categories.map(c => (
							<option key={c.value} value={c.value}>{c.label}</option>
						))}
					</Input>
				)}
				<button title={"+ Добавить"} type="submit" className={s.btn}>+ Добавить</button>
			</form>

			{!loading && loadFailed && <button title={"Повторить загрузку"} type="button" className={s.btnSmall} onClick={() => load()}>Повторить загрузку</button>}
			{loading && <p className={s.muted}>Загрузка…</p>}

			{!loading && !loadFailed && (
				<table className={s.table}>
					<thead>
						<tr>
							<th>value</th>
							<th>Название</th>
							{categories && <th>Класс</th>}
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
								{categories && (
									<td>
										<Input as="select"
											label="Категория"
											value={e.category ?? ''}
											onChange={ev => handleChangeCategory(e, ev.target.value)}
										>
											{categories.map(c => (
												<option key={c.value} value={c.value}>{c.label}</option>
											))}
										</Input>
									</td>
								)}
								<td className={s.muted}>{e.order}</td>
								<td>
									<button title={"Удалить"}
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
							<tr><td colSpan={categories ? 5 : 4} className={s.muted}>Пусто</td></tr>
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
		<Input
			type="text"
			value={v}
			onChange={e => setV(e.target.value)}
			onBlur={save}
			onKeyDown={e => {
				if (e.key === 'Enter') save()
				if (e.key === 'Escape') { setV(value); setEditing(false) }
			}}
			autoFocus
			label="Название"
		/>
	)
}

export default DictionaryTab
