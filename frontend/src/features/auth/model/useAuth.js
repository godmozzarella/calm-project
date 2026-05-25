import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { authApi } from '@/shared/api'
import { validateEmail, validatePassword } from '@/shared/lib/validation'

const DEBOUNCE_MS = 700

export const useAuth = () => {
  const navigate = useNavigate()

  const [loginEmail,    setLoginEmailState]    = useState('')
  const [loginPassword, setLoginPasswordState] = useState('')

  const [registerEmail,    setRegisterEmail]    = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [confirmPassword,  setConfirmPassword]  = useState('')
  const [confirmTouched,   setConfirmTouched]   = useState(false)
  const [userName,         setUserNameState]    = useState('')

  const [emailError,            setEmailError]            = useState('')
  const [loginPasswordError,    setLoginPasswordError]    = useState('')
  const [registerPasswordError, setRegisterPasswordError] = useState('')
  const [loginFormError,        setLoginFormError]        = useState('')
  const [registerFormError,     setRegisterFormError]     = useState('')

  const [loading, setLoading] = useState(false)
  const [retryAfter, setRetryAfter] = useState(0)

  const startCountdown = (seconds, setError) => {
    setRetryAfter(seconds)
    setError(`Слишком много попыток. Подождите ${seconds} сек.`)
    const timer = setInterval(() => {
      setRetryAfter(prev => {
        const next = prev - 1
        if (next <= 0) {
          clearInterval(timer)
          setError('')
          return 0
        }
        setError(`Слишком много попыток. Подождите ${next} сек.`)
        return next
      })
    }, 1000)
  }

  useEffect(() => {
    const t = setTimeout(() => setEmailError(validateEmail(registerEmail)), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [registerEmail])

  useEffect(() => {
    const t = setTimeout(() => setLoginPasswordError(validatePassword(loginPassword)), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [loginPassword])

  useEffect(() => {
    const t = setTimeout(() => setRegisterPasswordError(validatePassword(registerPassword)), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [registerPassword])

  const confirmPasswordError =
    confirmTouched && confirmPassword && confirmPassword !== registerPassword
      ? 'Пароли не совпадают'
      : ''

  const handleEmailChange = (e, type = 'register') => {
    if (type === 'register') setRegisterEmail(e.target.value)
    else setLoginEmailState(e.target.value)
    setLoginFormError('')
    setRegisterFormError('')
  }

  const handleLogin = async e => {
    e.preventDefault()
    setLoginFormError('')

    if (!loginEmail || !loginPassword) {
      setLoginFormError('Пожалуйста, заполните все поля')
      return
    }

    setLoading(true)
    try {
      await authApi.login(loginEmail, loginPassword)
      setLoginEmailState('')
      setLoginPasswordState('')
      navigate('/profile')
    } catch (err) {
      if (err.retryAfter) {
        startCountdown(err.retryAfter, setLoginFormError)
      } else {
        setLoginFormError(err.message ?? 'Неверный email или пароль')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegistration = async e => {
    e.preventDefault()
    setRegisterFormError('')

    if (!userName || !registerEmail || !registerPassword || !confirmPassword) {
      setRegisterFormError('Пожалуйста, заполните все поля')
      return
    }
    if (emailError) { setRegisterFormError('Введите корректный email'); return }
    if (registerPasswordError) { setRegisterFormError(registerPasswordError); return }
    if (registerPassword !== confirmPassword) { setRegisterFormError('Пароли не совпадают'); return }

    setLoading(true)
    try {
      await authApi.register(registerEmail, registerPassword, userName)
      setRegisterEmail('')
      setRegisterPassword('')
      setConfirmPassword('')
      setConfirmTouched(false)
      setUserNameState('')
      navigate('/profile')
    } catch (err) {
      if (err.retryAfter) {
        startCountdown(err.retryAfter, setRegisterFormError)
      } else {
        setRegisterFormError(err.message ?? 'Ошибка регистрации')
      }
    } finally {
      setLoading(false)
    }
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
    confirmPasswordError,
    loginFormError,
    registerFormError,
    loading,
    retryAfter,
    setLoginPassword:    e => { setLoginPasswordState(e.target.value);    setLoginFormError('') },
    setRegisterPassword: e => { setRegisterPassword(e.target.value);      setRegisterFormError('') },
    setConfirmPassword:  e => { setConfirmPassword(e.target.value); setConfirmTouched(true); setRegisterFormError('') },
    setUserName:         e => { setUserNameState(e.target.value);          setRegisterFormError('') },
    handleEmailChange,
    handleRegistration,
    handleLogin,
  }
}
