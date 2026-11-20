import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '@/shared/api'
import { notifyError } from '@/shared/lib/notifyError'
import { Button } from '@/shared/ui/Button'
import s from './AuthForm.module.scss'

export default function EmailLoginPage() {
	const reportedInvalidLink = useRef(false)
	const [token] = useState(() => window.location.hash.slice(1))
	const [busy, setBusy] = useState(false)
	const [success, setSuccess] = useState(false)
	const [expired, setExpired] = useState(!token)

	useEffect(() => {
		if (window.location.hash) {
			window.history.replaceState(window.history.state, '', window.location.pathname)
		}
		if (!token && !reportedInvalidLink.current) {
			reportedInvalidLink.current = true
			notifyError('Запросите новое письмо для входа.', 'Ссылка для входа недействительна')
		}
	}, [token])

	const confirm = async () => {
		setBusy(true)
		try {
			await authApi.verifyLink(token)
			setSuccess(true)
		} catch (failure) {
			setExpired(failure.status === 410)
			if (!failure.networkFailure) {
				const message = failure.status === 410
					? 'Ссылка истекла или уже использована. Запросите новое письмо.'
					: failure.retryAfter ? `Попробуйте снова через ${failure.retryAfter} сек.`
						: 'Попробуйте ещё раз или запросите новое письмо.'
				notifyError(message, 'Не удалось войти по ссылке')
			}
		} finally {
			setBusy(false)
		}
	}

	return (
		<main className={s.linkPage}>
			<section className={s.authWrapper}>
				<h1>{success ? 'Вход выполнен' : 'Вход в Calm'}</h1>
				{success ? (
					<>
						<p>Вы вошли в Calm в этом браузере. Если вы запрашивали письмо на другом устройстве, можно вернуться к нему. Чтобы войти там, запросите новое письмо.</p>
						<Link title={"Перейти в дневник"} to="/profile">Перейти в дневник</Link>
					</>
				) : (
					<>
						{expired ? <Link title={"Получить новый код"} to="/#regAndLog" state={{ scrollToSection: 'regAndLog' }}>Получить новый код</Link> : (
							<Button type="button" colored onClick={confirm} disabled={busy}>
								{busy ? 'Подтверждаем…' : 'Войти в Calm'}
							</Button>
						)}
					</>
				)}
			</section>
		</main>
	)
}
