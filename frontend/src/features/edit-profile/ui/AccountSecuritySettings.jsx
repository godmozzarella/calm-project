import { useEffect, useState } from 'react'
import { authApi, userApi } from '@/shared/api'
import { Button } from '@/shared/ui/Button'
import { FieldError, Input } from '@/shared/ui/Input'
import { isValidEmail } from '@/shared/lib/validation/email'
import CodeBoxes from '@/shared/ui/CodeBoxes/CodeBoxes'
import { notifyRequestError } from '@/shared/lib/notifyError'
import s from './AccountSecuritySettings.module.scss'

const AccountSecuritySettings = ({ user }) => {
	const [emailStep, setEmailStep] = useState('closed')
	const [newEmail, setNewEmail] = useState('')
	const [pendingEmail, setPendingEmail] = useState('')
	const [confirmCurrent, setConfirmCurrent] = useState(false)
	const [code, setCode] = useState('')
	const [resendAfter, setResendAfter] = useState(0)
	const [emailError, setEmailError] = useState('')
	const [emailBusy, setEmailBusy] = useState(false)

	useEffect(() => {
		if (resendAfter <= 0) return undefined
		const timer = window.setTimeout(() => setResendAfter(value => Math.max(0, value - 1)), 1000)
		return () => window.clearTimeout(timer)
	}, [resendAfter])

	const showCodeStep = status => {
		setPendingEmail(status.pendingEmail)
		setConfirmCurrent(status.confirmCurrent)
		setResendAfter(status.resendAfterSeconds)
		setCode('')
		setEmailStep('code')
	}

	const recoverEmailChange = async () => {
		try {
			const status = await userApi.getEmailChangeStatus()
			if (status.active) showCodeStep(status)
		} catch { /* Keep the original request's error. */ }
	}

	const openEmailChange = async () => {
		setEmailStep('start')
		setEmailError('')
		setEmailBusy(true)
		try {
			const status = await userApi.getEmailChangeStatus()
			if (status.active) showCodeStep(status)
		} catch (error) {
			notifyRequestError(error, 'Не удалось проверить состояние смены почты')
		} finally {
			setEmailBusy(false)
		}
	}

	const startEmailChange = async event => {
		event.preventDefault()
		if (emailBusy) return
		if (!isValidEmail(newEmail.trim())) {
			setEmailError('Проверьте новый адрес почты. Например, name@example.com.')
			return
		}
		setEmailBusy(true)
		setEmailError('')
		try {
			showCodeStep(await userApi.startEmailChange(newEmail))
		} catch (error) {
			if (error.status === 400) setEmailError('Проверьте новый адрес почты.')
			else notifyRequestError(error, 'Не удалось начать смену почты')
			if (error.status === 503 || error.networkFailure) await recoverEmailChange()
		} finally {
			setEmailBusy(false)
		}
	}

	const resendCode = async () => {
		if (emailBusy || resendAfter > 0) return
		setEmailBusy(true)
		setEmailError('')
		try {
			const status = await userApi.resendEmailChangeCode()
			setResendAfter(status.resendAfterSeconds)
			setCode('')
		} catch (error) {
			notifyRequestError(error, 'Не удалось отправить новый код')
			if (error.retryAfter) setResendAfter(error.retryAfter)
		} finally {
			setEmailBusy(false)
		}
	}

	const confirmEmailChange = async event => {
		event.preventDefault()
		if (emailBusy || code.length !== 6) return
		setEmailBusy(true)
		setEmailError('')
		try {
			const status = await userApi.confirmEmailChange(code)
			if (status.active) {
				showCodeStep(status)
				return
			}
			await authApi.logout()
			window.alert('Адрес почты изменён. Войдите в Calm с новым адресом.')
			window.location.assign('/#regAndLog')
		} catch (error) {
			if (error.status === 400 && /(?:код неверный|введите шестизначный)/i.test(error.message)) setEmailError(error.message)
			else notifyRequestError(error, 'Не удалось подтвердить адрес')
			if (error.status === 503 || error.networkFailure) await recoverEmailChange()
		} finally {
			setEmailBusy(false)
		}
	}

	const cancelEmailChange = async () => {
		if (emailBusy) return
		setEmailBusy(true)
		setEmailError('')
		try {
			await userApi.cancelEmailChange()
			setEmailStep('start')
			setPendingEmail('')
			setCode('')
			setNewEmail('')
		} catch (error) {
			notifyRequestError(error, 'Не удалось отменить смену почты')
		} finally {
			setEmailBusy(false)
		}
	}


	return (
		<section className={s.security} aria-label="Безопасность аккаунта">
			<div className={s.heading}>
				<h2>Безопасность</h2>
			</div>
			<p className={s.headingHint}>Почта для входа</p>
			<details className={s.section}>
				<summary className={s.summary}>
					<span className={s.summaryText}><strong>Электронная почта</strong><span>{user?.email}</span></span>
				</summary>
				<div className={s.sectionBody}>
				{emailStep === 'closed' ? (
					<Button type="button" colored onClick={openEmailChange} disabled={emailBusy}>Изменить почту</Button>
				) : emailStep === 'start' ? (
					<form className={s.form} onSubmit={startEmailChange} autoComplete="off" noValidate>
						<p className={s.description}>Сначала подтвердите текущий адрес, затем новый. До завершения для входа используется текущий адрес.</p>
						<Input id="emailChangeNewAddress" type="email" autoComplete="email" label="Новый адрес" value={newEmail} required error={emailError} onChange={event => { setNewEmail(event.target.value); setEmailError('') }} />
						<div className={s.actions}>
							<Button type="submit" colored disabled={emailBusy}>{emailBusy ? 'Отправляем…' : 'Отправить код'}</Button>
							<button title={"Закрыть"} type="button" className={s.textButton} onClick={() => { setEmailStep('closed'); setEmailError('') }}>Закрыть</button>
						</div>
					</form>
				) : (
					<form className={s.form} onSubmit={confirmEmailChange}>
						<p className={s.description}>Введите код из письма на <strong>{confirmCurrent ? user?.email : pendingEmail}</strong>.</p>
						<FieldError id="email-change-code-error">{emailError}</FieldError>
						<CodeBoxes code={code} setCode={value => { setCode(value); setEmailError('') }} length={6} inputId="email-change-code" errorId={emailError ? 'email-change-code-error' : undefined} invalid={Boolean(emailError)} disabled={emailBusy} />
						<div className={s.actions}>
							<Button type="submit" colored disabled={emailBusy || code.length !== 6}>{emailBusy ? 'Проверяем…' : confirmCurrent ? 'Подтвердить текущую почту' : 'Подтвердить новый адрес'}</Button>
							<button type="button" className={s.textButton} onClick={resendCode} disabled={emailBusy || resendAfter > 0}>{resendAfter > 0 ? `Отправить снова через ${resendAfter} сек.` : 'Отправить код снова'}</button>
							<button title={"Отменить смену"} type="button" className={s.textButton} onClick={cancelEmailChange} disabled={emailBusy}>Отменить смену</button>
						</div>
					</form>
				)}
				</div>
			</details>

		</section>
	)
}

export default AccountSecuritySettings
