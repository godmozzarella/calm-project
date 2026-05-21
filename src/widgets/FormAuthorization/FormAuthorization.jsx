import { useState } from 'react'
import FormRegistration from '../../entities/FormRegistration/FormRegistration'
import FormLogin from '../../entities/FormLogin/FormLogin'

import s from './FormAuthorization.module.scss'

const Form = props => {
	const {
		handleRegistration,
		handleLogin,
		loginEmail,
		registerEmail,
		loginPassword,
		registerPassword,
		confirmPassword,
		setConfirmPassword,
		userName,
		setUserName,
		emailError,
		handleEmailChange,
		loginError,
		registerError,
		setLoginPassword,
		setRegisterPassword
	} = props

	const [activeTab, setActiveTab] = useState('login')

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
				></div>
			</div>

			{activeTab === 'login' && (
				<FormLogin
					onSubmit={handleLogin}
					email={loginEmail}
					setEmail={e => handleEmailChange(e, 'login')}
					password={loginPassword}
					passwordError={loginError}
					setPassword={setLoginPassword}
					emailError={emailError}
				/>
			)}

			{activeTab === 'register' && (
				<FormRegistration
					onSubmit={handleRegistration}
					email={registerEmail}
					setEmail={e => handleEmailChange(e, 'register')}
					password={registerPassword}
					setPassword={setRegisterPassword}
					confirmPassword={confirmPassword}
					setConfirmPassword={setConfirmPassword}
					userName={userName}
					setUserName={setUserName}
					passwordError={registerError}
					emailError={emailError}
				/>
			)}
		</div>
	)
}

export default Form
