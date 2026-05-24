import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
	addUser,
	findUserByCredentials,
	isEmailTaken,
	setCurrentUser
} from '@/entities/user'
import { validateEmail, validatePassword } from '@/shared/lib/validation'

const DEBOUNCE_MS = 700

export const useAuth = () => {
	const navigate = useNavigate()

	const [loginEmail, setLoginEmail] = useState('')
	const [loginPassword, setLoginPassword] = useState('')
	const [registerEmail, setRegisterEmail] = useState('')
	const [registerPassword, setRegisterPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [confirmTouched, setConfirmTouched] = useState(false)
	const [userName, setUserName] = useState('')

	/* ── debounced field errors ── */
	const [emailError, setEmailError] = useState('')
	const [loginPasswordError, setLoginPasswordError] = useState('')
	const [registerPasswordError, setRegisterPasswordError] = useState('')

	/* ── form-level errors (не field) ── */
	const [loginFormError, setLoginFormError] = useState('')
	const [registerFormError, setRegisterFormError] = useState('')

	/* ── email debounce (только для регистрации) ── */
	useEffect(() => {
		const t = setTimeout(() => setEmailError(validateEmail(registerEmail)), DEBOUNCE_MS)
		return () => clearTimeout(t)
	}, [registerEmail])

	/* ── password debounces ── */
	useEffect(() => {
		const t = setTimeout(() => setLoginPasswordError(validatePassword(loginPassword)), DEBOUNCE_MS)
		return () => clearTimeout(t)
	}, [loginPassword])

	useEffect(() => {
		const t = setTimeout(() => setRegisterPasswordError(validatePassword(registerPassword)), DEBOUNCE_MS)
		return () => clearTimeout(t)
	}, [registerPassword])

	/* ── confirmPassword — реактивно (не debounce) ── */
	const confirmPasswordError =
		confirmTouched && confirmPassword && confirmPassword !== registerPassword
			? 'Пароли не совпадают'
			: ''

	const handleEmailChange = (e, type = 'register') => {
		if (type === 'register') {
			setRegisterEmail(e.target.value)
		} else {
			setLoginEmail(e.target.value)
		}
		setLoginFormError('')
		setRegisterFormError('')
	}

	const handleLogin = e => {
		e.preventDefault()
		setLoginFormError('')

		if (!loginEmail || !loginPassword) {
			setLoginFormError('Пожалуйста, заполните все поля')
			return
		}

		const user = findUserByCredentials(loginEmail, loginPassword)
		if (!user) {
			setLoginFormError('Неверный email или пароль')
			return
		}

		setCurrentUser(user)
		setLoginEmail('')
		setLoginPassword('')
		navigate('/profile')
	}

	const handleRegistration = e => {
		e.preventDefault()
		setRegisterFormError('')

		if (!userName || !registerEmail || !registerPassword || !confirmPassword) {
			setRegisterFormError('Пожалуйста, заполните все поля')
			return
		}
		if (emailError) {
			setRegisterFormError('Введите корректный email')
			return
		}
		if (registerPasswordError) {
			setRegisterFormError(registerPasswordError)
			return
		}
		if (registerPassword !== confirmPassword) {
			setRegisterFormError('Пароли не совпадают')
			return
		}
		if (isEmailTaken(registerEmail)) {
			setRegisterFormError('Пользователь с таким email уже существует')
			return
		}

		const newUser = {
			id: Date.now(),
			email: registerEmail,
			password: registerPassword,
			name: userName,
			avatar: null
		}

		addUser(newUser)
		setCurrentUser(newUser)

		setRegisterEmail('')
		setRegisterPassword('')
		setConfirmPassword('')
		setConfirmTouched(false)
		setUserName('')

		navigate('/profile')
	}

	return {
		/* values */
		loginEmail,
		loginPassword,
		registerEmail,
		registerPassword,
		confirmPassword,
		userName,
		/* field errors */
		emailError,
		loginPasswordError,
		registerPasswordError,
		confirmPasswordError,
		/* form errors */
		loginFormError,
		registerFormError,
		/* setters */
		setLoginPassword: e => { setLoginPassword(e.target.value); setLoginFormError('') },
		setRegisterPassword: e => { setRegisterPassword(e.target.value); setRegisterFormError('') },
		setConfirmPassword: e => {
			setConfirmPassword(e.target.value)
			setConfirmTouched(true)
			setRegisterFormError('')
		},
		setUserName: e => { setUserName(e.target.value); setRegisterFormError('') },
		handleEmailChange,
		handleRegistration,
		handleLogin,
	}
}
