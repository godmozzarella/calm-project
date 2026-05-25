import { useEffect, useState } from 'react'

import { adminApi } from '@/shared/api'
import { getCurrentUser } from '@/entities/user'

import s from './Tab.module.scss'

const UsersTab = () => {
	const [users, setUsers] = useState([])
	const [q, setQ] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const me = getCurrentUser()

	const load = (query = '') => {
		setLoading(true)
		setError(null)
		adminApi.listUsers(query)
			.then(setUsers)
			.catch(e => setError(e.message))
			.finally(() => setLoading(false))
	}

	useEffect(() => { load() }, [])

	const handleSearch = e => {
		e.preventDefault()
		load(q)
	}

	const toggleRole = async user => {
		const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN'
		const verb = newRole === 'ADMIN' ? 'назначить администратором' : 'снять права администратора'
		if (!window.confirm(`${verb.charAt(0).toUpperCase() + verb.slice(1)} у ${user.email}?`)) return
		try {
			const updated = await adminApi.changeRole(user.id, newRole)
			setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
		} catch (e) {
			alert(e.message)
		}
	}

	return (
		<div className={s.wrap}>
			<form className={s.toolbar} onSubmit={handleSearch}>
				<input
					type="text"
					value={q}
					onChange={e => setQ(e.target.value)}
					placeholder="Поиск по email или имени"
					className={s.input}
				/>
				<button type="submit" className={s.btn}>Найти</button>
			</form>

			{error && <p className={s.error}>{error}</p>}
			{loading && <p className={s.muted}>Загрузка…</p>}

			{!loading && !error && (
				<table className={s.table}>
					<thead>
						<tr>
							<th>Email</th>
							<th>Имя</th>
							<th>Роль</th>
							<th>Создан</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{users.map(u => (
							<tr key={u.id}>
								<td>{u.email}</td>
								<td>{u.name}</td>
								<td>
									<span className={`${s.badge} ${u.role === 'ADMIN' ? s.badgeAdmin : ''}`}>
										{u.role}
									</span>
								</td>
								<td className={s.muted}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('ru-RU') : '—'}</td>
								<td>
									{u.id === me?.id ? (
										<span className={s.muted}>—</span>
									) : (
										<button
											type="button"
											className={s.btnSmall}
											onClick={() => toggleRole(u)}
										>
											{u.role === 'ADMIN' ? 'Снять админа' : 'Сделать админом'}
										</button>
									)}
								</td>
							</tr>
						))}
						{users.length === 0 && (
							<tr><td colSpan={5} className={s.muted}>Никого не нашлось</td></tr>
						)}
					</tbody>
				</table>
			)}
		</div>
	)
}

export default UsersTab
