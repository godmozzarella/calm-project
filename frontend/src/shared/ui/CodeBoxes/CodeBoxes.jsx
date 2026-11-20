import { useEffect, useRef, useState } from 'react'
import s from './CodeBoxes.module.scss'

export default function CodeBoxes({ code, setCode, length = 6, disabled = false, autoFocus = false, inputId, errorId, invalid = false }) {
	const input = useRef(null)
	const [focused, setFocused] = useState(false)
	const [activeIndex, setActiveIndex] = useState(0)

	useEffect(() => {
		if (!autoFocus || disabled) return
		input.current?.focus({ preventScroll: true })
		input.current?.setSelectionRange(0, 0)
	}, [autoFocus, disabled])

	const fill = value => {
		const nextCode = value.replace(/\D/g, '').slice(0, length)
		setCode(nextCode)
		setActiveIndex(Math.min(nextCode.length, length - 1))
		requestAnimationFrame(() => input.current?.setSelectionRange(nextCode.length, nextCode.length))
	}

	const moveCaretToNextEmpty = () => {
		const position = Math.min(code.length, length - 1)
		setActiveIndex(position)
		input.current?.setSelectionRange(code.length, code.length)
	}

	return (
		<div className={s.codeBoxes}>
			<div className={s.cells} aria-hidden="true">
				{Array.from({ length }, (_, index) => (
					<span
						key={index}
						className={`${s.codeBox} ${focused && activeIndex === index ? s.active : ''} ${invalid ? s.invalid : ''}`}
					>
						{code[index] ?? ''}
					</span>
				))}
			</div>
			<input title={`${length}-значный код из письма`}
				ref={input}
				id={inputId}
				className={s.codeInput}
				type="text"
				inputMode="numeric"
				autoComplete="one-time-code"
				pattern="[0-9]*"
				maxLength={length}
				value={code}
				onChange={event => fill(event.target.value)}
				onPaste={event => {
					event.preventDefault()
					const pasted = event.clipboardData.getData('text')
					const start = event.currentTarget.selectionStart ?? code.length
					const end = event.currentTarget.selectionEnd ?? start
					const digits = pasted.replace(/\D/g, '')
					fill(digits.length >= length ? digits : code.slice(0, start) + digits + code.slice(end))
				}}
				onFocus={() => { setFocused(true); moveCaretToNextEmpty() }}
				onBlur={() => setFocused(false)}
				onClick={moveCaretToNextEmpty}
				disabled={disabled}
				aria-label={`${length}-значный код из письма`}
				aria-invalid={invalid}
				aria-describedby={errorId}
			/>
		</div>
	)
}
