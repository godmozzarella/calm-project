import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/shared/api'
import { getCurrentUser } from '@/entities/user'
import { Button } from '@/shared/ui/Button'
import { FieldError, Input } from '@/shared/ui/Input'
import { notifyError } from '@/shared/lib/notifyError'
import { clearPendingEmailLogin, readPendingEmailLogin, savePendingEmailLogin } from '@/shared/lib/pendingEmailLogin'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import { isValidEmail } from '@/shared/lib/validation/email'
import CodeBoxes from '@/shared/ui/CodeBoxes/CodeBoxes'
import { CloseIcon } from '@/shared/ui/icons'
import s from './AuthForm.module.scss'

const inboxes = {
	'gmail.com': 'https://mail.google.com/',
	'yandex.ru': 'https://mail.yandex.ru/',
	'ya.ru': 'https://mail.yandex.ru/',
	'mail.ru': 'https://e.mail.ru/',
	'bk.ru': 'https://e.mail.ru/',
	'outlook.com': 'https://outlook.live.com/mail/',
	'icloud.com': 'https://www.icloud.com/mail/',
}

const emailFormatError = 'Проверьте адрес почты. Например, name@example.com.'
const codeLength = 4

const describeFailure = (failure, verifying) => {
	if (failure.networkFailure) return 'Не удалось связаться с Calm. Проверьте подключение и попробуйте снова.'
	if (failure.retryAfter) return 'Слишком много запросов. Попробуйте снова после окончания таймера.'
	if (failure.status === 410) return 'Код истёк, уже использован или больше не действует. Запросите новый код.'
	if (failure.status === 400) return verifying ? 'Код неверный. Проверьте письмо и введите код ещё раз.' : emailFormatError
	return verifying
		? 'Не удалось проверить код. Попробуйте ещё раз или запросите новый.'
		: 'Не удалось отправить письмо. Проверьте адрес и попробуйте ещё раз.'
}

export default function AuthForm({ title }) {
	const navigate = useNavigate()
	const [restored] = useState(readPendingEmailLogin)
	const [email, setEmail] = useState(restored?.address ?? '')
	const [sentTo, setSentTo] = useState(restored?.address ?? '')
	const [dialogOpen, setDialogOpen] = useState(Boolean(restored))
	const [code, setCode] = useState('')
	const [error, setError] = useState('')
	const [invalidated, setInvalidated] = useState(false)
	const [busy, setBusy] = useState(false)
	const [retryAt, setRetryAt] = useState(restored?.retryAt ?? 0)
	const [retryAddress, setRetryAddress] = useState(restored?.address ?? '')
	const [codeExpiresAt, setCodeExpiresAt] = useState(restored?.expiresAt ?? 0)
	const [now, setNow] = useState(Date.now)
	const pending = useRef(false)
	const dialogRef = useRef(null)
	const emailRef = useRef(null)
	useBodyScrollLock(dialogOpen)

	useEffect(() => {
		const notice = sessionStorage.getItem('calm_login_notice')
		if (notice) notifyError(notice, 'Вход в Calm')
		sessionStorage.removeItem('calm_login_notice')
	}, [])
	useLayoutEffect(() => {
		const dialog = dialogRef.current
		if (!dialogOpen || !dialog) return
		dialog.showModal()
		return () => dialog.close()
	}, [dialogOpen])

	const seconds = Math.max(0, Math.ceil((retryAt - now) / 1000))
	const countingDown = seconds > 0
	const expired = invalidated || (codeExpiresAt > 0 && codeExpiresAt <= now)
	const address = email.trim().toLowerCase()
	const requestBlocked = seconds > 0 && address === retryAddress && address !== sentTo

	useEffect(() => {
		if (!countingDown && (!dialogOpen || expired)) return
		const interval = setInterval(() => setNow(Date.now()), 250)
		return () => clearInterval(interval)
	}, [countingDown, dialogOpen, expired])

	useEffect(() => {
		if (!sentTo) return
		const onStorage = event => {
			if (event.key === 'calm_current_user' && getCurrentUser()?.email === sentTo) {
				clearPendingEmailLogin()
				navigate('/profile', { replace: true })
			}
		}
		window.addEventListener('storage', onStorage)
		return () => window.removeEventListener('storage', onStorage)
	}, [navigate, sentTo])

	const run = async (address, action, verifying = false) => {
		if (pending.current) return
		pending.current = true
		setBusy(true)
		setError('')
		try {
			await action()
		} catch (failure) {
			const message = describeFailure(failure, verifying)
			if (failure.status === 400) setError(message)
			else if (!failure.networkFailure) notifyError(message, verifying ? 'Не удалось подтвердить вход' : 'Письмо не отправлено')
			if (failure.status === 410) {
				setInvalidated(true)
				clearPendingEmailLogin()
			}
			if (failure.retryAfter) {
				setRetryAddress(address)
				setNow(Date.now())
				setRetryAt(Date.now() + failure.retryAfter * 1000)
			}
			setCode('')
		} finally {
			pending.current = false
			setBusy(false)
		}
	}

	const request = address => {
		void run(address, async () => {
			await authApi.requestEmail(address)
			setSentTo(address)
			setDialogOpen(true)
			setCode('')
			setInvalidated(false)
			const receivedAt = Date.now()
			const retryAt = receivedAt + 60_000
			const expiresAt = receivedAt + 600_000
			savePendingEmailLogin({ address, retryAt, expiresAt })
			setNow(receivedAt)
			setRetryAddress(address)
			setRetryAt(retryAt)
			setCodeExpiresAt(expiresAt)
		})
	}

	const submitEmail = event => {
		event.preventDefault()
		if (requestBlocked) return
		if (!isValidEmail(address) || address.length > 254) {
			setError(emailFormatError)
			emailRef.current?.focus()
			return
		}
		if (!expired && address === sentTo && Date.now() < codeExpiresAt) {
			setError('')
			savePendingEmailLogin({ address, retryAt, expiresAt: codeExpiresAt })
			setDialogOpen(true)
			return
		}
		request(address)
	}

	const verify = value => {
		if (value.length !== codeLength || expired || Date.now() >= codeExpiresAt) return
		void run(sentTo, async () => {
			await authApi.verifyCode(sentTo, value)
			dialogRef.current?.close()
			navigate('/profile', { replace: true })
		}, true)
	}

	const closeDialog = () => {
		if (pending.current) return
		clearPendingEmailLogin()
		dialogRef.current.close()
		setDialogOpen(false)
		setCode('')
		setError('')
		emailRef.current?.focus()
	}

	const domain = sentTo.split('@')[1]
	const inbox = Object.hasOwn(inboxes, domain) ? inboxes[domain] : null
	return (
		<div className={s.floatingForm}>
			<header className={s.formHeader}>
				<h2>{title}</h2>
				<p>Войдите или создайте новый аккаунт</p>
			</header>
			<form className={s.emailForm} onSubmit={submitEmail} noValidate>
				<Input id="login-email" inputRef={emailRef} value={email}
					onChange={event => { setEmail(event.target.value); setError('') }}
					type="email" placeholder="Электронная почта" autoComplete="email" maxLength={254}
					error={!dialogOpen ? error : ''} disabled={busy} required />
				<Button type="submit" className={s.submitButton} colored disabled={!email || busy || requestBlocked}>
					{busy && !dialogOpen ? 'Отправляем…' : requestBlocked ? `Повторить через ${seconds} сек.` : 'Продолжить'}
				</Button>
			</form>

			<dialog className={s.codeDialog} ref={dialogRef} aria-labelledby="login-dialog-title"
				onCancel={event => { event.preventDefault(); closeDialog() }}>
				{dialogOpen && (
					<div className={s.dialogContent}>
						<h2 id="login-dialog-title">Проверьте почту</h2>
						<p>Отправили письмо на <strong className={s.sentAddress}>{sentTo}</strong>. Введите код или откройте ссылку из письма.</p>
						<form className={s.form} onSubmit={event => { event.preventDefault(); verify(code) }}>
							<FieldError id="login-code-error">{error}</FieldError>
							<CodeBoxes length={codeLength} code={code} setCode={value => { setCode(value); verify(value) }}
								autoFocus inputId="login-code" disabled={busy || expired}
								errorId={error ? 'login-code-error' : undefined} invalid={Boolean(error)} />
							{busy && <p role="status">Обрабатываем запрос…</p>}
						</form>
						<p>Если письма нет, проверьте папку «Спам».</p>
						{inbox && <a title={"Открыть почту"} href={inbox} target="_blank" rel="noreferrer">Открыть почту</a>}
						<div className={s.actions}>
							<Button type="button" colored className={s.changeEmail} onClick={closeDialog} disabled={busy}>Изменить email</Button>
							<Button type="button" colored onClick={() => request(sentTo)} disabled={busy || seconds > 0}>
								{seconds ? `Повторить через ${seconds} сек.` : expired ? 'Получить новый код' : 'Отправить ещё раз'}
							</Button>
						</div>
						<button title="Закрыть окно подтверждения" type="button" className={s.closeButton} onClick={closeDialog} disabled={busy}
							aria-label="Закрыть окно подтверждения"><CloseIcon sx={{ fontSize: '1.2rem' }} /></button>
					</div>
				)}
			</dialog>
		</div>
	)
}
