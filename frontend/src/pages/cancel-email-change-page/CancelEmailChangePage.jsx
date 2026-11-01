import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/shared/api'
import { Button } from '@/shared/ui/Button'
import { Header } from '@/widgets/header'
import { Footer } from '@/widgets/footer'
import s from './CancelEmailChangePage.module.scss'

const CancelEmailChangePage = () => {
	const [token, setToken] = useState('')
	const [busy, setBusy] = useState(false)
	const [message, setMessage] = useState('')
	const tokenRead = useRef(false)

	useEffect(() => {
		if (tokenRead.current) return
		tokenRead.current = true
		const suppliedToken = window.location.hash.slice(1)
		window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
		setToken(suppliedToken)
	}, [])

	const cancelChange = async () => {
		if (!token || busy) return
		setBusy(true)
		try {
			await authApi.cancelEmailChangeByToken(token)
			setMessage('Если запрос на смену почты ещё активен, он отменён. Для аккаунта сохранён прежний адрес.')
			setToken('')
		} catch (error) {
			setMessage(error.message || 'Не удалось обработать запрос. Откройте Calm и проверьте состояние почты в профиле.')
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className={s.page}>
			<Header />
			<main className={s.main}>
				<section className={s.card}>
					<p className={s.eyebrow}>Безопасность аккаунта</p>
					<h1>Отмена смены почты</h1>
					<p className={s.copy}>
						Если вы не запрашивали смену адреса в Calm, отмените её. Пока новый адрес не подтверждён, адрес аккаунта не меняется.
					</p>
					{message ? <p className={s.message} role="status">{message}</p> : token ? (
						<Button type="button" colored disabled={busy} onClick={cancelChange}>
							{busy ? 'Обрабатываем…' : 'Отменить запрос'}
						</Button>
					) : <p className={s.message}>Ссылка недействительна или в ней отсутствует код отмены.</p>}
					<Link className={s.homeLink} to="/">Вернуться в Calm</Link>
				</section>
			</main>
			<Footer />
		</div>
	)
}

export default CancelEmailChangePage
