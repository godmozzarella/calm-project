import { useId } from 'react'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import s from './Input.module.scss'

const formatDate = value => {
	if (!value) return 'Выберите дату'
	const date = new Date(`${value}T12:00:00`)
	if (Number.isNaN(date.getTime())) return ''
	return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
		.formatToParts(date)
		.filter(part => ['day', 'month', 'year'].includes(part.type))
		.map(part => part.value)
		.join(' ')
}

export const FieldError = ({ children, id }) => children
	? <p id={id} className={s.errorText} role="alert">{children}</p>
	: null

const Input = ({
	as: Control = 'input', id, type, placeholder, value, className = '', wrapperClassName = '',
	label, error, hint, rightElement, inputRef, children,
	'aria-describedby': describedBy, 'aria-invalid': invalid, ...props
}) => {
	const generatedId = useId()
	const fieldId = id || generatedId
	const caption = label || placeholder
	const hasNativeValue = Control === 'select' || ['date', 'time', 'datetime-local', 'month', 'week'].includes(type)
	const isDate = Control === 'input' && type === 'date'

	return (
		<div className={`${s.field} ${wrapperClassName}`}>
			<FieldError id={fieldId + '-error'}>{error}</FieldError>
			<div className={s.inputRow} data-float={hasNativeValue || undefined}>
				<Control
					{...props}
					ref={inputRef}
					id={fieldId}
					type={Control === 'input' ? type : undefined}
					value={value}
					title={props.title ?? caption ?? props['aria-label']}
					placeholder={Control !== 'select' && !hasNativeValue && caption ? (placeholder || caption) : undefined}
					className={`${s.input} ${isDate ? s.dateControl : ''} ${rightElement ? s.withRight : ''} ${className}`}
					aria-invalid={error ? true : invalid}
					aria-describedby={[describedBy, error && fieldId + '-error', hint && !error && fieldId + '-hint'].filter(Boolean).join(' ') || undefined}
				>{children}</Control>
				{isDate && <span className={`${s.input} ${s.dateDisplay}`} aria-hidden="true">
					<span>{formatDate(value)}</span>
					<CalendarMonthIcon />
				</span>}
				{caption && <>
					<fieldset className={s.border} aria-hidden="true"><legend><span>{caption}</span></legend></fieldset>
					<label htmlFor={fieldId} className={s.label}>{caption}</label>
				</>}
				{rightElement && <div className={s.rightElement}>{rightElement}</div>}
			</div>
			{hint && !error && <span className={s.hintText} id={fieldId + '-hint'}>{hint}</span>}
		</div>
	)
}

export default Input
