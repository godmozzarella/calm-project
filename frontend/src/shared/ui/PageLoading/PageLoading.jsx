import { useEffect, useState } from 'react'
import s from './PageLoading.module.scss'

const PageLoading = ({ label = 'Загружаем данные…', onContinue }) => {
	const [slow, setSlow] = useState(false)
	useEffect(() => {
		const timer = window.setTimeout(() => setSlow(true), 10_000)
		return () => window.clearTimeout(timer)
	}, [])

	return (
		<div className={s.overlay} role="status" aria-live="polite">
			<span className={s.spinner} aria-hidden="true" />
			<span>{slow ? 'Загрузка занимает больше времени…' : label}</span>
			{slow && onContinue && <button type="button" className={s.continue} onClick={onContinue}>Показать сейчас</button>}
		</div>
	)
}

export default PageLoading
