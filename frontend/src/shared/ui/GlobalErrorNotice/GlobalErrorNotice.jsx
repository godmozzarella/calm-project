import { useEffect, useRef, useState } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import ErrorNotice from '../ErrorNotice/ErrorNotice'
import s from './GlobalErrorNotice.module.scss'

const GlobalErrorNotice = () => {
	const [error, setError] = useState(null)
	const timer = useRef(null)
	useEffect(() => {
		const onError = event => {
			setError(event.detail)
			window.clearTimeout(timer.current)
			timer.current = window.setTimeout(() => setError(null), 7000)
		}
		window.addEventListener('calm:show-error', onError)
		return () => { window.removeEventListener('calm:show-error', onError); window.clearTimeout(timer.current) }
	}, [])
	if (!error) return null
	return <div className={s.toast}>
		<ErrorNotice title={error.title} message={error.message} />
		<button type="button" className={s.close} onClick={() => setError(null)} aria-label="Закрыть сообщение"><CloseIcon fontSize="small" /></button>
	</div>
}

export default GlobalErrorNotice
