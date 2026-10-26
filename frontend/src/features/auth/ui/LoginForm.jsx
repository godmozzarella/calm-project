import { useState } from 'react'

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
	} = props

	const [showPassword, setShowPassword] = useState(false)

	return (
		<form onSubmit={onSubmit} className={s.form} noValidate>
			<ErrorNotice message={formError} title="Не удалось войти" />

			<Input
				id="loginEmail"
				name="loginEmail"
				type="email"
				autoComplete="username"
				label="Электронная почта"
				placeholder="you@example.com"
				value={email}
				onChange={setEmail}
			/>

			<Input
				id="loginPassword"
				name="loginPassword"
				type={showPassword ? 'text' : 'password'}
				autoComplete="current-password"
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
		</form>
	)
}

export default LoginForm
