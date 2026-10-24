import { useEffect, useState } from 'react'

import { adminApi } from '@/shared/api'
import { getCurrentUser } from '@/entities/user'
import { notifyError } from '@/shared/lib/notifyError'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'

import s from './Tab.module.scss'

const UsersTab = () => {
	const [users, setUsers] = useState([])
	const [q, setQ] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const [participationByUser, setParticipationByUser] = useState({})
	const [deletingUserId, setDeletingUserId] = useState(null)
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
			notifyError(e.message)
		}
	}

	const deleteUser = async user => {
		const confirmed = window.confirm(
			`Удалить аккаунт ${user.email}? Будут безвозвратно удалены его приступы, лекарства, прогнозы, решения об участии и аватар.`
		)
		if (!confirmed) return
		setDeletingUserId(user.id)
		try {
			await adminApi.deleteUser(user.id)
			setUsers(prev => prev.filter(u => u.id !== user.id))
			setParticipationByUser(prev => {
				const next = { ...prev }
				delete next[user.id]
				return next
			})
		} catch (e) {
			notifyError(e.message)
		} finally {
			setDeletingUserId(null)
		}
	}

	const toggleParticipationAccess = async user => {
		try {
			let current = participationByUser[user.id]
			if (!current) {
				current = await adminApi.getSharedModelParticipation(user.id)
				setParticipationByUser(prev => ({ ...prev, [user.id]: current }))
				return
			}
			const blocked = !current.adminBlocked
			const message = blocked
				? (current.participating
					? `Отключить участие для ${user.email}? Данные перестанут попадать в новые учебные выборки после пересборки. Повторно согласиться пользователь не сможет, пока вы не разрешите участие.`
					: `Запретить ${user.email} участвовать в общей модели?`)
				: `Снова разрешить ${user.email} участвовать? Потребуется новое явное согласие.`
			if (!window.confirm(message)) return
			const updated = await adminApi.setSharedModelParticipationBlocked(user.id, blocked)
			setParticipationByUser(prev => ({ ...prev, [user.id]: updated }))
		} catch (e) {
			notifyError(e.message)
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

			<ErrorNotice message={error} title="Не удалось загрузить пользователей" />
			{loading && <p className={s.muted}>Загрузка…</p>}

			{!loading && !error && (
				<table className={s.table}>
					<thead>
						<tr>
							<th>Email</th>
							<th>Имя</th>
							<th>Роль</th>
							<th>Общая модель</th>
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
								<td>
									{(() => {
										const status = participationByUser[u.id]
										const label = !status ? 'Проверить' : status.adminBlocked
											? 'Разрешить участие'
											: status.participating ? 'Отключить участие' : 'Запретить участие'
										return (
											<div>
												<div className={s.muted}>{!status ? 'Статус не загружен' : status.adminBlocked
													? 'Отключено администратором'
													: status.participating ? 'Участвует' : 'Не участвует'}</div>
												<button type="button" className={s.btnSmall} onClick={() => toggleParticipationAccess(u)}>
													{label}
												</button>
											</div>
										)
									})()}
								</td>
								<td className={s.muted}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('ru-RU') : '—'}</td>
								<td>
									{u.id === me?.id ? (
										<span className={s.muted}>—</span>
									) : (
										<div className={s.rowActions}>
											<button
												type="button"
												className={s.btnSmall}
												onClick={() => toggleRole(u)}
											>
												{u.role === 'ADMIN' ? 'Снять админа' : 'Сделать админом'}
											</button>
											<button
												type="button"
												className={s.btnDanger}
												disabled={deletingUserId === u.id}
												onClick={() => deleteUser(u)}
											>
												{deletingUserId === u.id ? 'Удаление…' : 'Удалить'}
											</button>
										</div>
									)}
								</td>
							</tr>
						))}
						{users.length === 0 && (
								<tr><td colSpan={6} className={s.muted}>Никого не нашлось</td></tr>
						)}
					</tbody>
				</table>
			)}
		</div>
	)
}

export default UsersTab
