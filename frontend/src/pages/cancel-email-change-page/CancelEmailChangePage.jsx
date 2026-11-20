import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/shared/api'
import { notifyError, notifyRequestError } from '@/shared/lib/notifyError'
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
		if (!suppliedToken) notifyError('Откройте ссылку из письма о смене почты.', 'Ссылка для отмены недействительна')
	}, [])

	const cancelChange = async () => {
		if (!token || busy) return
		setBusy(true)
		try {
			await authApi.cancelEmailChangeByToken(token)
			setMessage('Если запрос на смену почты ещё активен, он отменён. Для аккаунта сохранён прежний адрес.')
			setToken('')
		} catch (error) {
			notifyRequestError(error, 'Не удалось отменить смену почты', 'Проверьте состояние почты в профиле.')
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
					) : null}
					<Link title={"Вернуться в Calm"} className={s.homeLink} to="/">Вернуться в Calm</Link>
				</section>
			</main>
			<Footer />
		</div>
	)
}

export default CancelEmailChangePage
