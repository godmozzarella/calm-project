import { useEffect, useRef, useState } from 'react'
import s from './CodeBoxes.module.scss'

export default function CodeBoxes({ code, setCode, length = 4, disabled = false, autoFocus = false, labelId, inputId, errorId, invalid = false }) {
	const input = useRef(null)
	const [focused, setFocused] = useState(false)
	const [activeIndex, setActiveIndex] = useState(0)

	useEffect(() => {
		if (!autoFocus || disabled) return
		input.current?.focus()
		input.current?.setSelectionRange(0, 0)
	}, [autoFocus, disabled])

	const handleChange = event => {
		const nextCode = event.target.value.replace(/\D/g, '').slice(0, length)
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
		<div className={`${s.codeBoxes} ${length > 4 ? s.longCode : ''}`} role="group" aria-labelledby={labelId}>
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
			<input
				ref={input}
				id={inputId}
				className={s.codeInput}
				type="text"
				inputMode="numeric"
				autoComplete="one-time-code"
				pattern="[0-9]*"
				maxLength={length}
				value={code}
				onChange={handleChange}
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
