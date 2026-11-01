import { useState } from 'react'

import { useAuth } from '../model/useAuth'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'
import EmailVerificationModal from './EmailVerificationModal'
import ForgotPasswordModal from './ForgotPasswordModal'

import s from './AuthForm.module.scss'

const AuthForm = () => {
	const [activeTab, setActiveTab] = useState('login')
	const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)

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
		retryAfter,
		loading,
		pendingVerification,
		verificationCode,
		verificationError,
		resendCountdown,
		setLoginPassword,
		setRegisterPassword,
		setConfirmPassword,
		setVerificationCode,
		setUserName,
		handleEmailChange,
		handleRegistration,
		handleVerifyRegistration,
		handleResendRegistrationCode,
		handleCancelRegistration,
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
					className={`${s.tabSlider} ${activeTab === 'register' ? s.tabSliderRight : ''}`}
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
						disabled={loading || retryAfter > 0}
						onForgotPassword={() => setForgotPasswordOpen(true)}
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
						loading={loading}
					/>
				)}
			</div>
			{pendingVerification && (
				<EmailVerificationModal
					email={pendingVerification.email}
					code={verificationCode}
					setCode={setVerificationCode}
					error={verificationError}
					countdown={resendCountdown}
					loading={loading}
					codeSent={pendingVerification.codeSent}
					onSubmit={handleVerifyRegistration}
					onResend={handleResendRegistrationCode}
					onClose={handleCancelRegistration}
				/>
			)}
			{forgotPasswordOpen && <ForgotPasswordModal initialEmail={loginEmail} onClose={() => setForgotPasswordOpen(false)} />}
		</div>
	)
}

export default AuthForm
