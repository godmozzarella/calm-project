import Button from '../../shared/Button/Button'
import Input from '../../shared/Input/Input'

import s from './FormRegistration.module.scss'

const FormRegistration = props => {
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
					pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#_@$!%*?&])[A-Za-z\d#_@$!%*?&]{8,}$"
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
			<Button
				colored
				children={<>Зарегистрироваться</>}
			/>
		</form>
	)
}

export default FormRegistration
