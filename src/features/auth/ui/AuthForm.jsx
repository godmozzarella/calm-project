import { useState } from 'react'

import { useAuth } from '../model/useAuth'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'

import s from './AuthForm.module.scss'

const AuthForm = () => {
	const [activeTab, setActiveTab] = useState('login')

	const {
		loginEmail,
		loginPassword,
		registerEmail,
		registerPassword,
		confirmPassword,
		userName,
		emailError,
		loginPasswordError,
		registerPasswordError,
		confirmPasswordError,
		loginFormError,
		registerFormError,
		setLoginPassword,
		setRegisterPassword,
		setConfirmPassword,
		setUserName,
		handleEmailChange,
		handleRegistration,
		handleLogin,
	} = useAuth()

	return (
		<div className={s.authWrapper}>
			<div className={s.tabSwitcher}>
				<button
					type="button"
					className={`${s.tab} ${activeTab === 'login' ? s.tabActive : ''}`}
					onClick={() => setActiveTab('login')}
				>
					Вход
				</button>
				<button
					type="button"
					className={`${s.tab} ${activeTab === 'register' ? s.tabActive : ''}`}
					onClick={() => setActiveTab('register')}
				>
					Регистрация
				</button>
				<div
					className={s.tabSlider}
					style={{ left: activeTab === 'register' ? '50%' : '0%' }}
				/>
			</div>

			<div className={s.formArea}>
				{activeTab === 'login' ? (
					<LoginForm
						onSubmit={handleLogin}
						email={loginEmail}
						setEmail={e => handleEmailChange(e, 'login')}
						password={loginPassword}
						setPassword={setLoginPassword}
						passwordError={loginPasswordError}
						formError={loginFormError}
					/>
				) : (
					<RegisterForm
						onSubmit={handleRegistration}
						email={registerEmail}
						setEmail={e => handleEmailChange(e, 'register')}
						password={registerPassword}
						setPassword={setRegisterPassword}
						confirmPassword={confirmPassword}
						setConfirmPassword={setConfirmPassword}
						userName={userName}
						setUserName={setUserName}
						emailError={emailError}
						passwordError={registerPasswordError}
						confirmPasswordError={confirmPasswordError}
						formError={registerFormError}
					/>
				)}
			</div>
		</div>
	)
}

export default AuthForm
