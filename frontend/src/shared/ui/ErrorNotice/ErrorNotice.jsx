import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import s from './ErrorNotice.module.scss'

const ErrorNotice = ({ message, title = 'Не удалось выполнить действие', className = '' }) => {
	if (!message) return null
	return <div className={`${s.notice} ${className}`} role="alert">
		<ErrorOutlineIcon className={s.icon} aria-hidden="true" />
		<div className={s.copy}>
			<strong>{title}</strong>
			<p>{message}</p>
		</div>
	</div>
}

export default ErrorNotice
