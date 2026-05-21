import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
	addUser,
	findUserByCredentials,
	isEmailTaken,
	setCurrentUser
} from '@/entities/user'
import { validateEmail, validatePassword } from '@/shared/lib/validation'

const DEBOUNCE_MS = 1000

export const useAuth = () => {
	const navigate = useNavigate()

	const [loginEmail, setLoginEmail] = useState('')
	const [loginPassword, setLoginPassword] = useState('')
	const [registerEmail, setRegisterEmail] = useState('')
	const [registerPassword, setRegisterPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [userName, setUserName] = useState('')

	const [emailError, setEmailError] = useState('')
	const [loginPasswordError, setLoginPasswordError] = useState('')
	const [registerPasswordError, setRegisterPasswordError] = useState('')

	useEffect(() => {
		const timer = setTimeout(() => {
			setEmailError(validateEmail(registerEmail))
		}, DEBOUNCE_MS)
		return () => clearTimeout(timer)
	}, [registerEmail])

	useEffect(() => {
		const timer = setTimeout(() => {
			setLoginPasswordError(validatePassword(loginPassword))
		}, DEBOUNCE_MS)
		return () => clearTimeout(timer)
	}, [loginPassword])

	useEffect(() => {
		const timer = setTimeout(() => {
			setRegisterPasswordError(validatePassword(registerPassword))
		}, DEBOUNCE_MS)
		return () => clearTimeout(timer)
	}, [registerPassword])

	const handleEmailChange = (e, type = 'register') => {
		const value = e.target.value
		if (type === 'register') {
			setRegisterEmail(value)
		} else {
			setLoginEmail(value)
		}
	}

	const handleRegistration = e => {
		e.preventDefault()

		if (!userName || !registerEmail || !registerPassword || !confirmPassword) {
			alert('Заполните все поля')
			return
		}
		if (registerPassword !== confirmPassword) {
			alert('Пароли не совпадают')
			return
		}
		if (emailError) {
			alert('Введите корректный email')
			return
		}
		if (registerPasswordError) {
			alert(registerPasswordError)
			return
		}
		if (isEmailTaken(registerEmail)) {
			alert('Пользователь с таким email уже зарегистрирован')
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
		setUserName('')

		alert('Вы зарегистрированы!')
		navigate('/profile')
	}

	const handleLogin = e => {
		e.preventDefault()

		if (!loginEmail || !loginPassword) {
			alert('Заполните все поля')
			return
		}
		if (loginPasswordError) {
			alert(loginPasswordError)
			return
		}

		const user = findUserByCredentials(loginEmail, loginPassword)
		if (!user) {
			alert('Неверный email или пароль')
			return
		}

		setCurrentUser(user)
		setLoginEmail('')
		setLoginPassword('')
		navigate('/profile')
	}

	return {
		loginEmail,
		loginPassword,
		registerEmail,
		registerPassword,
		confirmPassword,
		userName,
		emailError,
		loginPasswordError,
		registerPasswordError,
		setLoginPassword: e => setLoginPassword(e.target.value),
		setRegisterPassword: e => setRegisterPassword(e.target.value),
		setConfirmPassword: e => setConfirmPassword(e.target.value),
		setUserName: e => setUserName(e.target.value),
		handleEmailChange,
		handleRegistration,
		handleLogin
	}
}
