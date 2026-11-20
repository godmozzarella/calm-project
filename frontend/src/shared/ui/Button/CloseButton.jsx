import { CloseIcon } from '@/shared/ui/icons'
import s from './CloseButton.module.scss'

export default function CloseButton({ label = 'Закрыть', title = label, onClick, disabled }) {
	return (
		<button type="button" className={s.closeButton} aria-label={label} title={title} onClick={onClick} disabled={disabled}>
			<CloseIcon aria-hidden="true" />
		</button>
	)
}
