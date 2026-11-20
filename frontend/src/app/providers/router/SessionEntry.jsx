import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getCurrentUser } from '@/entities/user'
import { getToken, restoreSession } from '@/shared/api/httpClient'
import { Button } from '@/shared/ui/Button'
import PageLoading from '@/shared/ui/PageLoading/PageLoading'
import s from './SessionEntry.module.scss'

const hasSavedSession = () => Boolean(getToken() && getCurrentUser())

export default function SessionEntry({ children, openDiary = false }) {
	const [status, setStatus] = useState(() => hasSavedSession() ? 'ready' : 'checking')

	useEffect(() => {
		if (status !== 'checking') return
		let active = true
		restoreSession().then(result => {
			if (active) setStatus(result === null ? 'unavailable' : 'ready')
		})
		return () => { active = false }
	}, [status])

	useEffect(() => {
		if (status !== 'unavailable') return
		const retry = () => setStatus('checking')
		window.addEventListener('online', retry)
		return () => window.removeEventListener('online', retry)
	}, [status])

	if (status === 'checking') return <PageLoading label="Восстанавливаем вход…" />
	if (status === 'unavailable') return (
		<main className={s.retry}>
			<p role="status">Не удалось восстановить вход. Проверьте соединение.</p>
			<Button type="button" colored onClick={() => setStatus('checking')}>Повторить</Button>
		</main>
	)
	if (openDiary) return hasSavedSession() ? <Navigate to="/profile" replace /> : children
	return hasSavedSession() ? children : <Navigate to="/#regAndLog" replace />
}
