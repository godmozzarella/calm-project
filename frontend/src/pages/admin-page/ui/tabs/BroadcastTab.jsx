import { useEffect, useRef, useState } from 'react'

import { adminApi } from '@/shared/api'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'

import s from './Tab.module.scss'
import b from './BroadcastTab.module.scss'

const BroadcastTab = () => {
	const [subject, setSubject] = useState('')
	const [message, setMessage] = useState('')
	const [recipientCount, setRecipientCount] = useState(null)
	const [loadingAudience, setLoadingAudience] = useState(false)
	const [sending, setSending] = useState(false)
	const [error, setError] = useState('')
	const [confirmation, setConfirmation] = useState(null)
	const [result, setResult] = useState(null)
	const attempt = useRef(null)

	const refreshAudience = async () => {
		setLoadingAudience(true)
		setError('')
		try {
			const audience = await adminApi.getBroadcastAudience()
			setRecipientCount(audience.recipientCount)
		} catch (err) {
			setError(err.message ?? 'Не удалось загрузить список получателей')
		} finally {
			setLoadingAudience(false)
		}
	}

	useEffect(() => { refreshAudience() }, [])

	const requestConfirmation = async event => {
		event.preventDefault()
		setError('')
		setResult(null)
		if (!subject.trim() || !message.trim()) {
			setError('Заполните тему и текст письма.')
			return
		}
		setLoadingAudience(true)
		try {
			const audience = await adminApi.getBroadcastAudience()
			setRecipientCount(audience.recipientCount)
			if (audience.recipientCount === 0) {
				setError('Пока нет пользователей с подтверждённой почтой и включёнными уведомлениями.')
				return
			}
			const draft = JSON.stringify([subject.trim(), message.trim(), audience.recipientCount])
            if (attempt.current?.draft !== draft) {
                const bytes = crypto.getRandomValues(new Uint8Array(16))
                attempt.current = { draft, requestId: Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('') }
            }
            setConfirmation({
                requestId: attempt.current.requestId,
				subject: subject.trim(),
				message: message.trim(),
				expectedRecipientCount: audience.recipientCount,
			})
		} catch (err) {
			setError(err.message ?? 'Не удалось проверить список получателей')
		} finally {
			setLoadingAudience(false)
		}
	}

	const confirmSend = async () => {
		if (!confirmation || sending) return
		setSending(true)
		setError('')
		try {
			const sent = await adminApi.sendBroadcast(confirmation)
			setResult(sent)
			attempt.current = null
			setConfirmation(null)
			try {
				const audience = await adminApi.getBroadcastAudience()
				setRecipientCount(audience.recipientCount)
			} catch { /* Отправка уже завершилась; не выдаём обновление счётчика за её ошибку. */ }
		} catch (err) {
			setConfirmation(null)
			setError(err.message ?? 'Не удалось отправить рассылку')
			try {
				const audience = await adminApi.getBroadcastAudience()
				setRecipientCount(audience.recipientCount)
			} catch { /* Основную ошибку отправки оставляем видимой. */ }
		} finally {
			setSending(false)
		}
	}

	return (
		<div className={s.wrap}>
			<h2 className={s.h2}>Email-рассылка</h2>
			<p className={s.muted}>
				Письмо получат пользователи с подтверждённой почтой, которые включили уведомления в профиле.
			</p>

			<div className={b.audience}>
				<p className={s.muted}>
					Получателей: <strong>{loadingAudience && recipientCount === null ? 'считаем…' : recipientCount ?? '—'}</strong>
				</p>
				<button type="button" className={s.btnSmall} onClick={refreshAudience} disabled={loadingAudience || sending}>
					Обновить
				</button>
			</div>

			<ErrorNotice message={error} title="Рассылка не отправлена" />
			{result && (
				<p className={b.result} role="status">
					Отправлено: {result.sentCount} из {result.recipientCount}.
					{result.failedCount > 0 && ` Не удалось отправить: ${result.failedCount}.`}
				</p>
			)}

			<form className={s.formStack} onSubmit={requestConfirmation}>
				<label className={s.field}>
					<span>Тема письма</span>
					<input
						type="text"
						className={s.input}
						maxLength={160}
						value={subject}
						onChange={event => setSubject(event.target.value)}
						placeholder="Короткая тема сообщения"
						required
					/>
				</label>
				<label className={s.field}>
					<span>Текст письма</span>
					<textarea
						className={`${s.input} ${b.messageInput}`}
						rows={7}
						maxLength={10000}
						value={message}
						onChange={event => setMessage(event.target.value)}
						placeholder="Напишите сообщение обычным текстом"
						required
					/>
					<span className={b.counter}>{message.length}/10000</span>
				</label>
				<button
					type="submit"
					className={s.btn}
					disabled={loadingAudience || sending || recipientCount === 0}
				>
					{loadingAudience ? 'Проверяем получателей…' : 'Подготовить отправку'}
				</button>
			</form>

			{confirmation && (
				<div className={b.confirmOverlay}>
					<section className={b.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="broadcastConfirmTitle">
						<p className={b.confirmEyebrow}>Проверьте перед отправкой</p>
						<h3 id="broadcastConfirmTitle">Точно отправить письмо?</h3>
						<p className={b.confirmCopy}>
							Письмо <strong>«{confirmation.subject}»</strong> получат <strong>{confirmation.expectedRecipientCount}</strong> пользователей, включивших email-уведомления. Отменить отправку после подтверждения нельзя.
						</p>
						<div className={b.preview}>
							<strong>{confirmation.subject}</strong>
							<p>{confirmation.message}</p>
						</div>
						<div className={b.confirmActions}>
							<button type="button" className={s.btnSmall} onClick={() => setConfirmation(null)} disabled={sending}>
								Вернуться к письму
							</button>
							<button type="button" className={s.btn} onClick={confirmSend} disabled={sending}>
								{sending ? 'Отправляем…' : 'Да, отправить'}
							</button>
						</div>
					</section>
				</div>
			)}
		</div>
	)
}

export default BroadcastTab
