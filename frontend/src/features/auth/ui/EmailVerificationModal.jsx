import { createPortal } from 'react-dom'
import { Button } from '@/shared/ui/Button'
import CodeBoxes from '@/shared/ui/CodeBoxes/CodeBoxes'
import { CloseIcon } from '@/shared/ui/icons'
import s from './EmailVerificationModal.module.scss'

const formatCountdown = seconds => {
	const minutes = Math.floor(seconds / 60)
	const remainingSeconds = seconds % 60
	return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

export default function EmailVerificationModal({
	email,
	code,
	setCode,
	error,
	countdown,
	loading,
	codeSent,
	onSubmit,
	onResend,
	onClose,
}) {
	return createPortal(
		<div className={s.overlay}>
			<section className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="verifyEmailTitle">
				<button type="button" className={s.closeButton} onClick={onClose} disabled={loading} aria-label="Закрыть и изменить данные регистрации">
					<CloseIcon aria-hidden="true" />
				</button>
				<div className={s.content}>
					<p className={s.eyebrow}>Почти готово</p>
					<h2 id="verifyEmailTitle">Подтвердите почту</h2>
					<p className={s.description}>
						Введите четырёхзначный код, чтобы завершить регистрацию.
					</p>
					<form className={s.form} onSubmit={onSubmit}>
						<label className={s.codeLabel} id="registrationCodeLabel" htmlFor="registrationCodeInput">Код из письма</label>
						<CodeBoxes
							code={code}
							setCode={setCode}
							disabled={!codeSent || loading}
							autoFocus={codeSent}
							labelId="registrationCodeLabel"
							inputId="registrationCodeInput"
							errorId={error ? 'registrationCodeError' : undefined}
							invalid={Boolean(error)}
						/>
						{codeSent && <p className={s.sentNote}>Код отправлен на <strong>{email}</strong></p>}
						{error && <p className={s.error} id="registrationCodeError" role="alert">{error}</p>}
						<Button type="submit" colored className={s.submitButton} disabled={!codeSent || loading || code.length !== 4}>
							{loading ? (codeSent ? 'Проверяем…' : 'Отправляем код…') : 'Подтвердить email'}
						</Button>
					</form>
					<Button
						type="button"
						className={s.resendButton}
						onClick={onResend}
						disabled={loading || countdown > 0 || !codeSent}
					>
						{countdown > 0 ? `Запросить код повторно · ${formatCountdown(countdown)}` : 'Запросить код повторно'}
					</Button>
				</div>
			</section>
		</div>,
		document.body,
	)
}
