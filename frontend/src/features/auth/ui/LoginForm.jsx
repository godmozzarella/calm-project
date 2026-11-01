import { useRef, useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { VisibilityIcon, VisibilityOffIcon } from '@/shared/ui/icons'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'

import s from './LoginForm.module.scss'

const LoginForm = props => {
	const {
		onSubmit,
		email,
		setEmail,
		password,
		setPassword,
		passwordError,
		formError,
		disabled,
		onForgotPassword,
	} = props

	const [showPassword, setShowPassword] = useState(false)
	const [desktopCredentialsEnabled, setDesktopCredentialsEnabled] = useState(false)
	const emailRef = useRef(null)
	const passwordRef = useRef(null)
	const guardDesktopAutofill = window.matchMedia?.('(pointer: fine)').matches ?? true
	const enableCredentialFields = () => {
		if (desktopCredentialsEnabled) return
		if (emailRef.current) emailRef.current.value = ''
		if (passwordRef.current) passwordRef.current.value = ''
		setEmail({ target: { value: '' } })
		setPassword({ target: { value: '' } })
		setDesktopCredentialsEnabled(true)
	}

	return (
		<form onSubmit={onSubmit} className={s.form} noValidate autoComplete="off">
			<ErrorNotice message={formError} title="Не удалось войти" />

			<Input
				inputRef={emailRef}
				id="loginEmail"
				name="calm-account-field"
				type="email"
				autoComplete="off"
				readOnly={guardDesktopAutofill && !desktopCredentialsEnabled}
				onFocus={enableCredentialFields}
				label="Электронная почта"
				placeholder="you@example.com"
				value={email}
				onChange={setEmail}
			/>

			<Input
				inputRef={passwordRef}
				id="loginPassword"
				name="calm-secret-field"
				type={showPassword ? 'text' : 'password'}
				autoComplete="off"
				readOnly={guardDesktopAutofill && !desktopCredentialsEnabled}
				onFocus={enableCredentialFields}
				className={s.passwordInput}
				label="Пароль"
				placeholder="••••••••"
				value={password}
				onChange={setPassword}
				error={passwordError || ''}
				rightElement={
					<button
						type="button"
						onClick={() => setShowPassword(p => !p)}
						tabIndex={-1}
						aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
					>
						{showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
					</button>
				}
			/>

			<Button type="submit" colored className={s.submitBtn} disabled={disabled}>
				Войти
			</Button>
			<button type="button" className={s.forgotButton} onClick={onForgotPassword}>Забыли пароль?</button>
		</form>
	)
}

export default LoginForm
