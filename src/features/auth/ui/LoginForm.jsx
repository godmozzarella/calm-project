import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { PASSWORD_PATTERN } from '@/shared/lib/validation'

const LoginForm = props => {
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
				pattern={PASSWORD_PATTERN}
			/>
			<Button colored>Войти</Button>
		</form>
	)
}

export default LoginForm
