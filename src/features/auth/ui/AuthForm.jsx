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
		setLoginPassword,
		setRegisterPassword,
		setConfirmPassword,
		setUserName,
		handleEmailChange,
		handleRegistration,
		handleLogin
	} = useAuth()

	return (
		<div className={s.authWrapper}>
			<div className={s.tabSwitcher}>
				<div
					className={`${s.tab} ${activeTab === 'login' ? 'active' : ''}`}
					onClick={() => setActiveTab('login')}
				>
					Вход
				</div>
				<div
					className={`${s.tab} ${activeTab === 'register' ? 'active' : ''}`}
					onClick={() => setActiveTab('register')}
				>
					Регистрация
				</div>
				<div
					className={s.tabSlider}
					style={{ left: activeTab === 'register' ? '50%' : '0%' }}
				/>
			</div>

			{activeTab === 'login' && (
				<LoginForm
					onSubmit={handleLogin}
					email={loginEmail}
					setEmail={e => handleEmailChange(e, 'login')}
					password={loginPassword}
					setPassword={setLoginPassword}
					passwordError={loginPasswordError}
					emailError={emailError}
				/>
			)}

			{activeTab === 'register' && (
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
					passwordError={registerPasswordError}
					emailError={emailError}
				/>
			)}
		</div>
	)
}

export default AuthForm
