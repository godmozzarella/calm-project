import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { PASSWORD_PATTERN } from '@/shared/lib/validation'

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
		passwordError
	} = props

	return (
		<form onSubmit={onSubmit}>
			<Input
				type="text"
				placeholder="Введите имя"
				value={userName}
				onChange={setUserName}
			/>
			<div className={s.inputWrapper}>
				<Input
					type="email"
					placeholder="Электронная почта"
					value={email}
					onChange={setEmail}
				/>
				{emailError && <p className={s.errorText}>{emailError}</p>}
			</div>
			<div className={s.inputWrapper}>
				<Input
					type="password"
					placeholder="Пароль"
					value={password}
					onChange={setPassword}
					pattern={PASSWORD_PATTERN}
				/>
				{passwordError && <p className={s.errorText}>{passwordError}</p>}
			</div>
			<div className={s.inputWrapper}>
				<Input
					type="password"
					placeholder="Повторите пароль"
					value={confirmPassword}
					onChange={setConfirmPassword}
				/>
			</div>
			<Button colored>Зарегистрироваться</Button>
		</form>
	)
}

export default RegisterForm
