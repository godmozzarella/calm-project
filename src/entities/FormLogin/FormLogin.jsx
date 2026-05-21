import Button from '../../shared/Button/Button'
import Input from '../../shared/Input/Input'

const FormLogin = props => {
	const { onSubmit, email, setEmail, password, setPassword } = props

	return (
		<form onSubmit={onSubmit}>
			<Input
				id="email"
				type="email"
				placeholder="Электронная почта"
				value={email}
				onChange={setEmail}
			/>
			<Input
				id="password"
				type="password"
				placeholder="Пароль"
				value={password}
				onChange={setPassword}
				pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#_@$!%*?&])[A-Za-z\d#_@$!%*?&]{8,}$"
			/>
			<Button
				colored
				children={<>Войти</>}
			/>
		</form>
	)
}

export default FormLogin
