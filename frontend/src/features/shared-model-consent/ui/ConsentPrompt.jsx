import { useEffect, useRef } from 'react'

import s from './ConsentPrompt.module.scss'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'

const ConsentPrompt = ({ status, saving, error, onDecide }) => {
	const declineButton = useRef(null)
	const dialog = useRef(null)

	useEffect(() => {
		if (!status) return undefined
		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		declineButton.current?.focus()
		const trapFocus = event => {
			if (event.key !== 'Tab') return
			const buttons = dialog.current?.querySelectorAll('button:not(:disabled)')
			if (!buttons?.length) return
			const first = buttons[0]
			const last = buttons[buttons.length - 1]
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault()
				last.focus()
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault()
				first.focus()
			}
		}
		const node = dialog.current
		node?.addEventListener('keydown', trapFocus)
		return () => {
			node?.removeEventListener('keydown', trapFocus)
			document.body.style.overflow = previousOverflow
		}
	}, [status])

	if (!status) return null

	return (
		<div className={s.overlay}>
			<section ref={dialog} className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="consent-title"
				aria-describedby="consent-summary">
				<p className={s.eyebrow}>Участие добровольное</p>
				<h2 id="consent-title" className={s.title}>Поделиться данными для проверки модели?</h2>
				<p id="consent-summary" className={s.summary}>
					Некоторые сведения из дневника могут помочь проверить общую модель прогноза головной боли.
					Решение за вами: дневником можно пользоваться при любом выборе.
				</p>
				<div className={s.terms}>
					{status.consentText?.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
				</div>
				<ErrorNotice message={error} title="Не удалось сохранить выбор" />
				<div className={s.actions}>
					<button type="button" className={s.acceptButton} onClick={() => onDecide(true)} disabled={saving}>
						{saving ? 'Сохраняем…' : 'Согласиться и участвовать'}
					</button>
					<button ref={declineButton} type="button" className={s.declineButton}
						onClick={() => onDecide(false)} disabled={saving}>
						{saving ? 'Сохраняем…' : 'Продолжить без участия'}
					</button>
				</div>
			</section>
		</div>
	)
}

export default ConsentPrompt
