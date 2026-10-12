import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/shared/api'

export default function VerifyEmailPage() {
	const token = useRef(new URLSearchParams(window.location.hash.slice(1)).get('token')).current
	const started = useRef(false)
	const [message, setMessage] = useState('Проверяем ссылку…')
	const [result, setResult] = useState('pending')
	useEffect(() => {
		if (started.current) return
		started.current = true
		window.history.replaceState(null, '', '/verify-email')
		if (!token) {
			setMessage('В ссылке нет кода подтверждения.')
			setResult('error')
			return
		}
		void authApi.verifyEmail(token)
			.then(() => {
				setMessage('Email подтверждён. Теперь можно получать письма Calm.')
				setResult('success')
			})
			.catch(error => {
				setMessage(error.message || 'Не удалось подтвердить email.')
				setResult('error')
			})
	}, [token])
	return <main style={{ maxWidth: 520, margin: '10vh auto', padding: 24, color: '#f3f4f6' }}>
		<h1>Подтверждение email</h1>
		<p role="status" aria-live="polite" style={{
			margin: '20px 0 12px', padding: '14px 16px', borderRadius: 10,
			background: result === 'error' ? 'rgba(239, 68, 68, 0.14)' : result === 'success' ? 'rgba(34, 197, 94, 0.14)' : 'rgba(92, 173, 228, 0.14)',
			border: `1px solid ${result === 'error' ? 'rgba(239, 68, 68, 0.5)' : result === 'success' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(92, 173, 228, 0.5)'}`,
			color: '#f3f4f6', lineHeight: 1.5,
		}}>{message}</p>
		{result === 'error' && (
			<p style={{ color: '#cbd5e1', lineHeight: 1.5, marginBottom: 16 }}>
				Ссылка одноразовая и действует 24 часа. Если подтверждение не прошло, войдите в Calm и запросите новую ссылку в профиле.
			</p>
		)}
		<Link to="/profile" style={{ color: '#7dd3fc' }}>Вернуться в приложение</Link>
	</main>
}
