import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import CloseIcon from '@mui/icons-material/Close'
import ErrorNotice from '../ErrorNotice/ErrorNotice'
import s from './GlobalErrorNotice.module.scss'

const networkNotice = () => navigator.onLine
	? { title: 'Сервер недоступен', message: 'Проверьте соединение и повторите действие.' }
	: { title: 'Нет подключения к интернету', message: 'Подключитесь к сети и повторите действие.' }

const GlobalErrorNotice = () => {
	const [errors, setErrors] = useState([])
	const [networkError, setNetworkError] = useState(() => navigator.onLine ? null : networkNotice())
	const popup = useRef(null)
	const error = errors[0]
	const visible = error || networkError
	// A native modal makes the rest of the document inert.
	const portalTarget = visible && (document.querySelector('dialog[open]') || document.body)

	useLayoutEffect(() => {
		const onError = event => {
			const next = event.detail
			setErrors(previous => previous.some(item => item.message === next.message && item.title === next.title)
				? previous : [...previous, next])
		}
		window.addEventListener('calm:show-error', onError)
		return () => window.removeEventListener('calm:show-error', onError)
	}, [])

	useEffect(() => {
		if (!error) return
		const timer = window.setTimeout(() => setErrors(previous => previous[0] === error ? previous.slice(1) : previous), 7000)
		return () => window.clearTimeout(timer)
	}, [error])

	useEffect(() => {
		const show = () => setNetworkError(networkNotice())
		const hide = () => setNetworkError(null)
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

	useLayoutEffect(() => {
		const element = popup.current
		if (!visible || !element?.showPopover) return
		element.showPopover()
		return () => { if (element.matches(':popover-open')) element.hidePopover() }
	}, [visible, portalTarget])

	if (!visible) return null
	return createPortal(<div ref={popup} popover="manual" className={s.toast}>
		<ErrorNotice title={visible.title} message={visible.message} />
		<button title="Закрыть сообщение" type="button" className={s.close} onClick={() => error
			? setErrors(previous => previous[0] === error ? previous.slice(1) : previous)
			: setNetworkError(null)}
			aria-label="Закрыть сообщение"><CloseIcon fontSize="small" /></button>
	</div>, portalTarget)
}

export default GlobalErrorNotice
