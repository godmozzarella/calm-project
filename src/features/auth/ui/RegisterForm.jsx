import { useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { VisibilityIcon, VisibilityOffIcon } from '@/shared/ui/icons'
import PasswordStrengthBar from './PasswordStrengthBar'

import s from './RegisterForm.module.scss'

const RegisterForm = props => {
	const {
		onSubmit,
		email,
		setEmail,
		password,
		setPassword,
		confirmPassword,
		setConfirmPassword,
		userName,
		setUserName,
		emailError,
		passwordError,
		confirmPasswordError,
		formError,
	} = props

	const [showPassword, setShowPassword] = useState(false)
	const [showConfirm, setShowConfirm] = useState(false)

	return (
		<form onSubmit={onSubmit} className={s.form} noValidate>
			{formError && (
				<div className={s.formError}>
					<span>{formError}</span>
				</div>
			)}

			<Input
				id="registerName"
				type="text"
				label="Имя"
				placeholder="Как вас зовут?"
				value={userName}
				onChange={setUserName}
			/>

			<Input
				id="registerEmail"
				type="email"
				label="Электронная почта"
				placeholder="you@example.com"
				value={email}
				onChange={setEmail}
				error={emailError || ''}
			/>

			<div className={s.passwordGroup}>
				<Input
					id="registerPassword"
					type={showPassword ? 'text' : 'password'}
					label="Пароль"
					placeholder="••••••••"
					value={password}
					onChange={setPassword}
					error={passwordError || ''}
					hint={!passwordError && password ? 'Минимум 8 символов, заглавная, цифра и спецсимвол' : ''}
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
				<PasswordStrengthBar password={password} />
			</div>

			<Input
				id="confirmPassword"
				type={showConfirm ? 'text' : 'password'}
				label="Повторите пароль"
				placeholder="••••••••"
				value={confirmPassword}
				onChange={setConfirmPassword}
				error={confirmPasswordError || ''}
				rightElement={
					<button
						type="button"
						onClick={() => setShowConfirm(p => !p)}
						tabIndex={-1}
						aria-label={showConfirm ? 'Скрыть пароль' : 'Показать пароль'}
					>
						{showConfirm ? <VisibilityOffIcon /> : <VisibilityIcon />}
					</button>
				}
			/>

			<Button type="submit" colored className={s.submitBtn}>
				Зарегистрироваться
			</Button>
		</form>
	)
}

export default RegisterForm
