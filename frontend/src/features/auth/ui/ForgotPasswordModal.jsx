import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { authApi } from '@/shared/api'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import CodeBoxes from '@/shared/ui/CodeBoxes/CodeBoxes'
import PasswordStrengthBar from './PasswordStrengthBar'
import { CloseIcon, VisibilityIcon, VisibilityOffIcon } from '@/shared/ui/icons'
import s from './ForgotPasswordModal.module.scss'

const ForgotPasswordModal = ({ initialEmail = '', onClose }) => {
	const [email, setEmail] = useState(initialEmail)
	const [step, setStep] = useState('email')
	const [code, setCode] = useState('')
	const [verificationToken, setVerificationToken] = useState('')
	const [password, setPassword] = useState('')
	const [repeat, setRepeat] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [showRepeat, setShowRepeat] = useState(false)
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	const [resendAfter, setResendAfter] = useState(0)

	useEffect(() => {
		if (resendAfter <= 0) return undefined
		const timer = window.setTimeout(() => setResendAfter(value => Math.max(0, value - 1)), 1000)
		return () => window.clearTimeout(timer)
	}, [resendAfter])

	const requestCode = async event => {
		event?.preventDefault()
		if (busy || resendAfter > 0 && step === 'code') return
		if (!email.trim()) { setError('Введите адрес электронной почты.'); return }
		setBusy(true)
		setError('')
		try {
			await authApi.requestPasswordReset(email.trim())
			setStep('code')
			setResendAfter(30)
			setCode('')
			setVerificationToken('')
			setPassword('')
			setRepeat('')
		} catch (requestError) {
			setError(requestError.message || 'Не удалось выполнить запрос. Попробуйте позже.')
			if (requestError.retryAfter) setResendAfter(requestError.retryAfter)
		} finally {
			setBusy(false)
		}
	}

    const verifyCode = async event => {
        event.preventDefault()
        if (busy || code.length !== 6) return
        setBusy(true)
        setError('')
        try {
            const result = await authApi.verifyPasswordReset(email.trim(), code)
            setVerificationToken(result.verificationToken)
            setCode('')
            setStep('password')
        } catch (requestError) {
            setError(requestError.message || 'Не удалось проверить код.')
        } finally { setBusy(false) }
    }

	const resetPassword = async event => {
		event.preventDefault()
		if (busy) return
		if (!verificationToken) { setStep('code'); setError('Подтвердите код из письма.'); return }
		if (!password || !repeat) { setError('Введите и повторите новый пароль.'); return }
		if (password !== repeat) { setError('Новые пароли не совпадают.'); return }
		setBusy(true)
		setError('')
		try {
			await authApi.confirmPasswordReset(email.trim(), verificationToken, password)
			setStep('done')
			setVerificationToken('')
			setPassword('')
			setRepeat('')
		} catch (requestError) {
			setError(requestError.message || 'Не удалось изменить пароль.')
		} finally {
			setBusy(false)
		}
	}

	return createPortal(
		<div className={s.overlay} onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
			<section className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="passwordResetTitle">
				<button className={s.close} type="button" onClick={onClose} disabled={busy} aria-label="Закрыть"><CloseIcon /></button>
				<div className={s.content}>
					<p className={s.eyebrow}>Доступ к аккаунту</p>
					<h2 id="passwordResetTitle">{step === 'done' ? 'Пароль изменён' : step === 'password' ? 'Новый пароль' : step === 'code' ? 'Подтвердите почту' : 'Восстановление пароля'}</h2>
					{step === 'email' && (
						<form className={s.form} onSubmit={requestCode}>
							<p className={s.description}>Укажите почту аккаунта. Если она подтверждена, мы отправим код для создания нового пароля.</p>
							<Input id="passwordResetEmail" type="email" autoComplete="email" label="Электронная почта" value={email} onChange={event => { setEmail(event.target.value); setError('') }} />
							{error && <p className={s.error} role="alert">{error}</p>}
							<Button type="submit" colored disabled={busy}>{busy ? 'Отправляем…' : 'Отправить код'}</Button>
						</form>
					)}
					{step === 'code' && (
						<form className={s.form} onSubmit={verifyCode}>
							<p className={s.description}>Если адрес привязан к подтверждённому аккаунту, код отправлен на <strong>{email}</strong>. Он действует 10 минут.</p>
							<label className={s.label} id="resetCodeLabel">Шестизначный код</label>
							<CodeBoxes autoFocus code={code} setCode={value => { setCode(value); setError('') }} length={6} labelId="resetCodeLabel" inputId="resetCodeInput" errorId="resetCodeError" invalid={Boolean(error)} disabled={busy} />
                            {error && <p className={s.error} id="resetCodeError" role="alert">{error}</p>}
                            <Button type="submit" colored disabled={busy || code.length !== 6}>{busy ? 'Проверяем…' : 'Подтвердить код'}</Button>
                            <button className={s.textButton} type="button" onClick={requestCode} disabled={busy || resendAfter > 0}>{resendAfter > 0 ? `Запросить код снова через ${resendAfter} сек.` : 'Запросить код снова'}</button>
                            <button className={s.textButton} type="button" disabled={busy} onClick={() => { setStep('email'); setCode(''); setError('') }}>Изменить почту</button>
                        </form>
                    )}
                    {step === 'password' && (
                        <form className={s.form} onSubmit={resetPassword}>
                            <p className={s.description}>Почта подтверждена. Придумайте новый пароль и повторите его.</p>
							<Input id="passwordResetNew" autoFocus type={showPassword ? 'text' : 'password'} autoComplete="new-password" label="Новый пароль" value={password} onChange={event => { setPassword(event.target.value); setError('') }} rightElement={<button type="button" onClick={() => setShowPassword(value => !value)} tabIndex={-1} aria-label={showPassword ? 'Скрыть новый пароль' : 'Показать новый пароль'}>{showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}</button>} />
							<PasswordStrengthBar password={password} />
							<Input id="passwordResetRepeat" type={showRepeat ? 'text' : 'password'} autoComplete="new-password" label="Повторите новый пароль" value={repeat} onChange={event => { setRepeat(event.target.value); setError('') }} rightElement={<button type="button" onClick={() => setShowRepeat(value => !value)} tabIndex={-1} aria-label={showRepeat ? 'Скрыть повтор пароля' : 'Показать повтор пароля'}>{showRepeat ? <VisibilityOffIcon /> : <VisibilityIcon />}</button>} />
							{error && <p className={s.error} role="alert">{error}</p>}
							<Button type="submit" colored disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить новый пароль'}</Button>
                            <button className={s.textButton} type="button" disabled={busy} onClick={() => { setStep('email'); setVerificationToken(''); setPassword(''); setRepeat(''); setError('') }}>Начать заново</button>
						</form>
					)}
					{step === 'done' && <>
						<p className={s.description}>Теперь войдите с новым паролем. Все активные сеансы завершены.</p>
						<Button type="button" colored onClick={onClose}>Вернуться ко входу</Button>
					</>}
				</div>
			</section>
		</div>,
		document.body,
	)
}

export default ForgotPasswordModal
