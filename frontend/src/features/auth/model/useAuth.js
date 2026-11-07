import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { authApi } from '@/shared/api'
import { validateEmail, validatePassword } from '@/shared/lib/validation'
import { isCentralError } from '@/shared/lib/isCentralError'

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
  const [pendingVerification, setPendingVerification] = useState(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationError, setVerificationError] = useState('')
  const [resendCountdown, setResendCountdown] = useState(0)

  useEffect(() => {
    if (!pendingVerification || resendCountdown <= 0) return undefined
    const timer = setInterval(() => setResendCountdown(value => Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [pendingVerification, resendCountdown])

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
    if (loading) return
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
      } else if (!isCentralError(err)) {
        setLoginFormError(err.message ?? 'Неверный email или пароль')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegistration = async e => {
    e.preventDefault()
    setRegisterFormError('')

    if (!userName.trim() || !registerEmail.trim() || !registerPassword || !confirmPassword) {
      setRegisterFormError('Пожалуйста, заполните все поля')
      return
    }
    const currentEmailError = validateEmail(registerEmail)
    if (currentEmailError) { setRegisterFormError(currentEmailError); return }
    const currentPasswordError = validatePassword(registerPassword)
    if (currentPasswordError) { setRegisterFormError(currentPasswordError); return }
    if (registerPassword !== confirmPassword) { setRegisterFormError('Пароли не совпадают'); return }
    if (userName.trim().length > 64) { setRegisterFormError('Имя должно быть не длиннее 64 символов'); return }

    setLoading(true)
    try {
      const email = registerEmail.trim()
      const password = registerPassword
      const name = userName.trim()
      const result = await authApi.register(email, password, name)
      setPendingVerification({ email: result.email, password, name, codeSent: true })
      setVerificationCode('')
      setVerificationError('')
      setResendCountdown(result.resendAfterSeconds ?? 30)
    } catch (err) {
      if (err.retryAfter) {
        startCountdown(err.retryAfter, setRegisterFormError)
      } else if (!isCentralError(err)) {
        setRegisterFormError(err.message ?? 'Ошибка регистрации')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyRegistration = async e => {
    e.preventDefault()
    if (!pendingVerification || !pendingVerification.codeSent) return
    if (!/^\d{4}$/.test(verificationCode)) {
      setVerificationError('Введите четырёхзначный код из письма')
      return
    }
    setLoading(true)
    setVerificationError('')
    try {
      await authApi.verifyRegistration(pendingVerification.email, pendingVerification.password, verificationCode)
      setPendingVerification(null)
      setVerificationCode('')
      setRegisterEmail('')
      setRegisterPassword('')
      setConfirmPassword('')
      setConfirmTouched(false)
      setUserNameState('')
      navigate('/profile')
    } catch (err) {
      if (!isCentralError(err)) setVerificationError(err.message ?? 'Не удалось подтвердить email')
    } finally {
      setLoading(false)
    }
  }

  const handleResendRegistrationCode = async () => {
    if (!pendingVerification || resendCountdown > 0 || loading) return
    setLoading(true)
    setVerificationError('')
    try {
      await authApi.resendRegistrationCode(pendingVerification.email, pendingVerification.password)
      setResendCountdown(30)
    } catch (err) {
      if (err.retryAfter) setResendCountdown(err.retryAfter)
      if (!isCentralError(err)) setVerificationError(err.message ?? 'Не удалось отправить код повторно')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelRegistration = async () => {
    if (!pendingVerification || loading) return
    setLoading(true)
    setVerificationError('')
    try {
      await authApi.cancelRegistration(pendingVerification.email, pendingVerification.password)
      setPendingVerification(null)
      setVerificationCode('')
      setResendCountdown(0)
      setRegisterFormError('')
    } catch (err) {
      if (!isCentralError(err)) setVerificationError(err.message ?? 'Не удалось отменить регистрацию')
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
    pendingVerification,
    verificationCode,
    verificationError,
    resendCountdown,
    setVerificationCode: value => { setVerificationCode(value.replace(/\D/g, '').slice(0, 4)); setVerificationError('') },
    setLoginPassword:    e => { setLoginPasswordState(e.target.value);    setLoginFormError('') },
    setRegisterPassword: e => { setRegisterPassword(e.target.value);      setRegisterFormError('') },
    setConfirmPassword:  e => { setConfirmPassword(e.target.value); setConfirmTouched(true); setRegisterFormError('') },
    setUserName:         e => { setUserNameState(e.target.value);          setRegisterFormError('') },
    handleEmailChange,
    handleRegistration,
    handleVerifyRegistration,
    handleResendRegistrationCode,
    handleCancelRegistration,
    handleLogin,
  }
}
