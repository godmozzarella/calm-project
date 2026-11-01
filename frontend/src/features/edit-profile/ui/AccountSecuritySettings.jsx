import { useEffect, useState } from 'react'
import { authApi, userApi } from '@/shared/api'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import CodeBoxes from '@/shared/ui/CodeBoxes/CodeBoxes'
import PasswordStrengthBar from '@/features/auth/ui/PasswordStrengthBar'
import { VisibilityIcon, VisibilityOffIcon } from '@/shared/ui/icons'
import s from './AccountSecuritySettings.module.scss'

const PasswordToggle = ({ visible, onToggle, label }) => (
	<button type="button" onClick={onToggle} tabIndex={-1} aria-label={`${visible ? 'Скрыть' : 'Показать'} ${label}`}>
		{visible ? <VisibilityOffIcon /> : <VisibilityIcon />}
	</button>
)

const AccountSecuritySettings = ({ user }) => {
	const [emailStep, setEmailStep] = useState('closed')
	const [currentPassword, setCurrentPassword] = useState('')
	const [newEmail, setNewEmail] = useState('')
	const [pendingEmail, setPendingEmail] = useState('')
	const [code, setCode] = useState('')
	const [resendAfter, setResendAfter] = useState(0)
	const [emailError, setEmailError] = useState('')
	const [emailCurrentPasswordError, setEmailCurrentPasswordError] = useState('')
	const [emailBusy, setEmailBusy] = useState(false)
	const [emailPasswordVisible, setEmailPasswordVisible] = useState(false)

	const [passwordCurrent, setPasswordCurrent] = useState('')
	const [passwordNew, setPasswordNew] = useState('')
	const [passwordRepeat, setPasswordRepeat] = useState('')
	const [passwordCurrentError, setPasswordCurrentError] = useState('')
	const [passwordNewError, setPasswordNewError] = useState('')
	const [passwordRepeatError, setPasswordRepeatError] = useState('')
	const [passwordGeneralError, setPasswordGeneralError] = useState('')
	const [passwordBusy, setPasswordBusy] = useState(false)
	const [passwordCurrentVisible, setPasswordCurrentVisible] = useState(false)
	const [passwordNewVisible, setPasswordNewVisible] = useState(false)
	const [passwordRepeatVisible, setPasswordRepeatVisible] = useState(false)

	useEffect(() => {
		if (resendAfter <= 0) return undefined
		const timer = window.setTimeout(() => setResendAfter(value => Math.max(0, value - 1)), 1000)
		return () => window.clearTimeout(timer)
	}, [resendAfter])

	const signOutAfterChange = async message => {
		authApi.clearLocalSession()
		window.alert(message)
		window.location.assign('/')
	}

	const openEmailChange = async () => {
		setEmailStep('start')
		setEmailError('')
		setCurrentPassword('')
		setEmailBusy(true)
		try {
			const status = await userApi.getEmailChangeStatus()
			if (status.active) {
				setPendingEmail(status.pendingEmail)
				setResendAfter(status.resendAfterSeconds)
				setEmailStep('code')
			}
		} catch (error) {
			setEmailError(error.message || 'Не удалось проверить состояние смены почты.')
		} finally {
			setEmailBusy(false)
		}
	}

	const startEmailChange = async event => {
		event.preventDefault()
		if (emailBusy) return
		setEmailBusy(true)
		setEmailError('')
		setEmailCurrentPasswordError('')
		try {
			const status = await userApi.startEmailChange(currentPassword, newEmail)
			setCurrentPassword('')
			setPendingEmail(status.pendingEmail)
			setResendAfter(status.resendAfterSeconds)
			setCode('')
			setEmailStep('code')
		} catch (error) {
			if (error.message === 'Неверный пароль') setEmailCurrentPasswordError('Текущий пароль введён неверно.')
			else setEmailError(error.message || 'Не удалось начать смену почты.')
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
			setEmailError(error.message || 'Не удалось отправить новый код.')
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
			await userApi.confirmEmailChange(code)
			await signOutAfterChange('Адрес почты изменён. Войдите в Calm с новым адресом.')
		} catch (error) {
			setEmailError(error.message || 'Не удалось подтвердить новый адрес.')
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
			setCurrentPassword('')
		} catch (error) {
			setEmailError(error.message || 'Не удалось отменить смену почты.')
		} finally {
			setEmailBusy(false)
		}
	}

	const changePassword = async event => {
		event.preventDefault()
		if (passwordBusy) return
		setPasswordCurrentError('')
		setPasswordNewError('')
		setPasswordRepeatError('')
		setPasswordGeneralError('')
		if (!passwordCurrent) {
			setPasswordCurrentError('Введите текущий пароль.')
			return
		}
		if (!passwordNew) {
			setPasswordNewError('Введите новый пароль.')
			return
		}
		if (!passwordRepeat) {
			setPasswordRepeatError('Повторите новый пароль.')
			return
		}
		if (passwordNew !== passwordRepeat) {
			setPasswordRepeatError('Пароли не совпадают.')
			return
		}
		setPasswordBusy(true)
		try {
			await userApi.changePassword(passwordCurrent, passwordNew)
			await signOutAfterChange('Пароль изменён. Войдите в Calm с новым паролем.')
		} catch (error) {
			const message = error.message || 'Не удалось изменить пароль.'
			if (message === 'Неверный пароль') setPasswordCurrentError('Текущий пароль введён неверно.')
			else if (message.startsWith('Новый пароль')) setPasswordNewError(message)
			else setPasswordGeneralError(message)
		} finally {
			setPasswordBusy(false)
		}
	}

	return (
		<section className={s.security} aria-label="Безопасность аккаунта">
			<div className={s.section}>
				<h3 className={s.title}>Электронная почта</h3>
				<p className={s.currentValue}>{user?.email}</p>
				{emailStep === 'closed' ? (
					<Button type="button" colored className={s.changeEmailButton} onClick={openEmailChange} disabled={emailBusy}>Изменить почту</Button>
				) : emailStep === 'start' ? (
					<form className={s.form} onSubmit={startEmailChange} autoComplete="off">
						<p className={s.description}>Подтвердите действие текущим паролем. Пока новый адрес не подтверждён, почта аккаунта останется прежней.</p>
						<Input id="emailChangeCurrentPassword" name="calm-email-security-check" type={emailPasswordVisible ? 'text' : 'password'} autoComplete="off" readOnly onFocus={event => { event.currentTarget.readOnly = false }} label="Текущий пароль" value={currentPassword} onChange={event => { setCurrentPassword(event.target.value); setEmailCurrentPasswordError('') }} error={emailCurrentPasswordError} rightElement={<PasswordToggle visible={emailPasswordVisible} onToggle={() => setEmailPasswordVisible(value => !value)} label="текущий пароль" />} />
						<Input id="emailChangeNewAddress" type="email" autoComplete="email" label="Новый адрес" value={newEmail} onChange={event => setNewEmail(event.target.value)} />
						{emailError && <p className={s.error} role="alert">{emailError}</p>}
						<div className={s.actions}>
							<Button type="submit" colored disabled={emailBusy}>{emailBusy ? 'Отправляем…' : 'Отправить код'}</Button>
							<button type="button" className={s.textButton} onClick={() => { setEmailStep('closed'); setEmailError('') }}>Закрыть</button>
						</div>
					</form>
				) : (
					<form className={s.form} onSubmit={confirmEmailChange}>
						<p className={s.description}>Код отправлен на <strong>{pendingEmail}</strong>. До подтверждения для входа используется {user?.email}.</p>
						<label className={s.codeLabel} id="email-change-code-label">Шестизначный код</label>
						<CodeBoxes code={code} setCode={value => { setCode(value); setEmailError('') }} length={6} labelId="email-change-code-label" inputId="email-change-code" errorId="email-change-code-error" invalid={Boolean(emailError)} disabled={emailBusy} />
						{emailError && <p className={s.error} id="email-change-code-error" role="alert">{emailError}</p>}
						<div className={s.actions}>
							<Button type="submit" colored disabled={emailBusy || code.length !== 6}>{emailBusy ? 'Проверяем…' : 'Подтвердить почту'}</Button>
							<button type="button" className={s.textButton} onClick={resendCode} disabled={emailBusy || resendAfter > 0}>{resendAfter > 0 ? `Отправить снова через ${resendAfter} сек.` : 'Отправить код снова'}</button>
							<button type="button" className={s.textButton} onClick={cancelEmailChange} disabled={emailBusy}>Отменить смену</button>
						</div>
					</form>
				)}
			</div>

			<div className={s.section}>
				<h3 className={s.title}>Пароль</h3>
				<form className={s.form} onSubmit={changePassword} autoComplete="off">
					<p className={s.description}>После смены пароля Calm завершит все активные сеансы.</p>
					<Input id="changePasswordCurrent" name="calm-account-check" type={passwordCurrentVisible ? 'text' : 'password'} autoComplete="off" readOnly onFocus={event => { event.currentTarget.readOnly = false }} label="Текущий пароль" value={passwordCurrent} onChange={event => { setPasswordCurrent(event.target.value); setPasswordCurrentError('') }} error={passwordCurrentError} rightElement={<PasswordToggle visible={passwordCurrentVisible} onToggle={() => setPasswordCurrentVisible(value => !value)} label="текущий пароль" />} />
					<Input id="changePasswordNew" type={passwordNewVisible ? 'text' : 'password'} autoComplete="new-password" label="Новый пароль" value={passwordNew} onChange={event => { setPasswordNew(event.target.value); setPasswordNewError('') }} error={passwordNewError} rightElement={<PasswordToggle visible={passwordNewVisible} onToggle={() => setPasswordNewVisible(value => !value)} label="новый пароль" />} />
					<PasswordStrengthBar password={passwordNew} />
					<Input id="changePasswordRepeat" type={passwordRepeatVisible ? 'text' : 'password'} autoComplete="new-password" label="Повторите новый пароль" value={passwordRepeat} onChange={event => { setPasswordRepeat(event.target.value); setPasswordRepeatError('') }} error={passwordRepeatError} rightElement={<PasswordToggle visible={passwordRepeatVisible} onToggle={() => setPasswordRepeatVisible(value => !value)} label="повтор нового пароля" />} />
					{passwordGeneralError && <p className={s.error} role="alert">{passwordGeneralError}</p>}
					<Button type="submit" colored disabled={passwordBusy}>{passwordBusy ? 'Сохраняем…' : 'Изменить пароль'}</Button>
				</form>
			</div>
		</section>
	)
}

export default AccountSecuritySettings
