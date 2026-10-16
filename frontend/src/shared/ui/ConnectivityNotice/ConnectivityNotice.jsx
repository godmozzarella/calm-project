import { useEffect, useState } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import ErrorNotice from '../ErrorNotice/ErrorNotice'
import s from './ConnectivityNotice.module.scss'

const ConnectivityNotice = () => {
	const [issue, setIssue] = useState(() => !navigator.onLine)
	useEffect(() => {
		const show = () => setIssue(true)
		const hide = () => setIssue(false)
		window.addEventListener('offline', show)
		window.addEventListener('online', hide)
		window.addEventListener('calm:network-error', show)
		window.addEventListener('calm:network-restored', hide)
		return () => {
			window.removeEventListener('offline', show)
			window.removeEventListener('online', hide)
			window.removeEventListener('calm:network-error', show)
			window.removeEventListener('calm:network-restored', hide)
		}
	}, [])
	if (!issue) return null
	return <div className={s.banner}>
		<ErrorNotice
			title={navigator.onLine ? 'Сервер недоступен' : 'Нет подключения к интернету'}
			message={navigator.onLine ? 'Данные могут не обновляться. Проверьте соединение и повторите действие.' : 'Данные могут не обновляться. Подключитесь к сети и повторите действие.'}
		/>
		<button type="button" className={s.close} onClick={() => setIssue(false)} aria-label="Закрыть сообщение"><CloseIcon fontSize="small" /></button>
	</div>
}

export default ConnectivityNotice
