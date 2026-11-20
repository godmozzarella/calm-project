import s from './RangeSlider.module.scss'

const valueAtPointer = event => {
	const input = event.currentTarget
	const bounds = input.getBoundingClientRect()
	const style = getComputedStyle(input)
	const thumbSize = Number.parseFloat(style.getPropertyValue('--thumb-size'))
	const leftPadding = Number.parseFloat(style.paddingLeft)
	const rightPadding = Number.parseFloat(style.paddingRight)
	const start = bounds.left + leftPadding + thumbSize / 2
	const travel = Math.max(1, bounds.width - leftPadding - rightPadding - thumbSize)
	const position = Math.max(0, Math.min(1, (event.clientX - start) / travel))
	return Math.round(Number(input.min) + position * (Number(input.max) - Number(input.min)))
}

export default function RangeSlider({ value, onChange, className = '', ...props }) {
	const drag = event => {
		const input = event.currentTarget
		if (!event.isPrimary || !input.hasPointerCapture(event.pointerId)) return
		const next = valueAtPointer(event)
		if (next !== Number(input.value)) onChange(next)
	}

	return (
		<input {...props} type="range" value={value} className={`${s.range} ${className}`}
			onChange={event => onChange(Number(event.target.value))}
			onPointerDown={event => {
				if (!event.isPrimary || event.button !== 0) return
				event.preventDefault()
				if (event.pointerType === 'mouse') event.currentTarget.focus({ preventScroll: true })
				event.currentTarget.setPointerCapture(event.pointerId)
				onChange(valueAtPointer(event))
			}}
			onPointerMove={drag}
			onPointerUp={event => {
				if (!event.isPrimary || !event.currentTarget.hasPointerCapture(event.pointerId)) return
				drag(event)
				event.currentTarget.releasePointerCapture(event.pointerId)
			}}
		/>
	)
}
