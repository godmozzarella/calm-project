import s from './Input.module.scss'

const Input = props => {
	const {
		id,
		type,
		placeholder,
		value,
		onChange,
		pattern,
		className,
		accept,
		label,
		error,
		hint,
		rightElement,
	} = props

	const hasWrapper = label || error !== undefined || hint || rightElement

	const inputEl = (
		<div className={`${s.inputRow} ${rightElement ? s.hasRight : ''}`}>
			<input
				className={`${s.input} ${className || ''} ${error ? s.inputError : ''} ${rightElement ? s.withRight : ''}`}
				id={id}
				placeholder={placeholder}
				type={type}
				value={value}
				onChange={onChange}
				pattern={pattern}
				accept={accept}
			/>
			{rightElement && <div className={s.rightElement}>{rightElement}</div>}
		</div>
	)

	if (!hasWrapper) return inputEl

	return (
		<div className={`${s.field} ${error ? s.fieldError : ''}`}>
			{label && (
				<label className={s.label} htmlFor={id}>
					{label}
				</label>
			)}
			{inputEl}
			{error && <span className={s.errorText}>{error}</span>}
			{hint && !error && <span className={s.hintText}>{hint}</span>}
		</div>
	)
}

export default Input
