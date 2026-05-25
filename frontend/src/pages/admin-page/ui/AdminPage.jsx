import { useState } from 'react'
import { Link } from 'react-router-dom'

import UsersTab from './tabs/UsersTab'
import DictionaryTab from './tabs/DictionaryTab'
import BroadcastTab from './tabs/BroadcastTab'

import s from './AdminPage.module.scss'

const TABS = [
	{ key: 'users',    label: 'Пользователи' },
	{ key: 'symptoms', label: 'Симптомы' },
	{ key: 'triggers', label: 'Триггеры' },
	{ key: 'broadcast', label: 'Рассылка' },
]

const AdminPage = () => {
	const [tab, setTab] = useState('users')

	return (
		<div className={s.page}>
			<Link to="/profile" className={s.back}>← К дневнику</Link>

			<h1 className={s.title}>Админ-панель</h1>

			<nav className={s.tabs} role="tablist">
				{TABS.map(t => (
					<button
						key={t.key}
						role="tab"
						aria-selected={tab === t.key}
						className={`${s.tab} ${tab === t.key ? s.tabActive : ''}`}
						onClick={() => setTab(t.key)}
					>
						{t.label}
					</button>
				))}
			</nav>

			<main className={s.content}>
				{tab === 'users' && <UsersTab />}
				{tab === 'symptoms' && <DictionaryTab type="SYMPTOM" title="Симптомы" />}
				{tab === 'triggers' && <DictionaryTab type="TRIGGER" title="Триггеры" />}
				{tab === 'broadcast' && <BroadcastTab />}
			</main>
		</div>
	)
}

export default AdminPage
