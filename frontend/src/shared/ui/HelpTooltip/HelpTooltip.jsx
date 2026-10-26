import { useEffect, useState } from 'react'
import s from './HelpTooltip.module.scss'

const CONTROL = '[data-help], button, a[href], input, select, textarea, [role="button"], [role="switch"]'
const HOVER_DELAY_MS = 700
const TOUCH_HOLD_MS = 700
const TOUCH_MOVE_LIMIT_PX = 12

const labelFor = element => {
	const id = element.id
	const linkedLabel = id && [...document.querySelectorAll('label[for]')]
		.find(label => label.htmlFor === id)?.textContent
	return (element.getAttribute('aria-label') || linkedLabel ||
		element.closest('label')?.textContent || element.textContent ||
		element.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ')
}

const helpFor = element => {
	if (element.hasAttribute('data-help')) return element.getAttribute('data-help')
	if (element.getAttribute('title')) return element.getAttribute('title')
	const label = labelFor(element)
	if (!label) {
		if (element.matches('input[type="date"]')) return 'Выберите дату.'
		if (element.matches('input[type="time"]')) return 'Выберите время.'
		if (element.matches('input, textarea')) return 'Введите данные в это поле.'
		if (element.matches('select')) return 'Выберите подходящий вариант.'
		if (element.matches('a[href]')) return 'Открыть ссылку.'
		return 'Нажмите, чтобы выполнить это действие.'
	}
	if (element.matches('a[href]')) return element.getAttribute('href')?.startsWith('mailto:')
		? `Написать письмо на адрес ${label}.`
		: `Перейти по ссылке «${label}».`
	if (element.matches('[role="switch"], input[type="checkbox"]')) return `Включить или выключить «${label}».`
	if (element.matches('input, textarea')) return `Введите «${label}».`
	if (element.matches('select')) return `Выберите «${label}».`
	return `Нажмите, чтобы выполнить действие «${label}».`
}

const HelpTooltip = () => {
	const [tooltip, setTooltip] = useState(null)

	useEffect(() => {
		let activeElement = null
		let nativeTitle = null
		let tooltipId = 0
		let hoverTimer = null
		let hoverElement = null
		let touch = null
		let suppressClickFor = null
		let suppressClickUntil = 0
		let inputMode = 'keyboard'
		const clearHover = () => {
			window.clearTimeout(hoverTimer)
			hoverTimer = null
			hoverElement = null
		}
		const clearTouch = () => {
			if (touch) {
				window.clearTimeout(touch.timer)
				if (touch.noSelect) touch.element.classList.remove(s.touchTarget)
			}
			touch = null
		}
		const hide = () => {
			clearHover()
			if (activeElement && nativeTitle !== null) activeElement.setAttribute('title', nativeTitle)
			activeElement = null
			nativeTitle = null
			setTooltip(null)
		}
		const show = (element, preferAbove = false) => {
			if (!element?.isConnected) return
			if (element.closest('[inert]')) return
			if (element.disabled || element.getAttribute('aria-disabled') === 'true') return
			const text = helpFor(element)
			if (!text) return
			if (element === activeElement) return
			hide()
			activeElement = element
			nativeTitle = element.getAttribute('title')
			if (nativeTitle !== null) element.removeAttribute('title')
			const rect = element.getBoundingClientRect()
			const margin = Math.min(160, window.innerWidth / 2)
			setTooltip({ id: ++tooltipId, text, x: Math.min(Math.max(rect.left + rect.width / 2, margin), window.innerWidth - margin),
				y: rect.bottom + 10, above: preferAbove ? rect.top > 100 : rect.bottom + 100 > window.innerHeight,
				top: rect.top - 10 })
		}
		const onPointerOver = event => {
			if (event.pointerType === 'touch' || !(event.target instanceof Element)) return
			const element = event.target.closest(CONTROL)
			if (!element || element === activeElement || element === hoverElement) return
			hide()
			hoverElement = element
			hoverTimer = window.setTimeout(() => show(element), HOVER_DELAY_MS)
		}
		const onPointerOut = event => {
			if (event.pointerType === 'touch') return
			const element = hoverElement || activeElement
			if (event.relatedTarget instanceof Node && element?.contains(event.relatedTarget)) return
			hide()
		}
		const onPointerDown = event => {
			inputMode = event.pointerType === 'touch' ? 'touch' : 'pointer'
			suppressClickFor = null
			hide()
			if (event.pointerType !== 'touch') return
			clearTouch()
			if (!(event.target instanceof Element)) return
			const element = event.target.closest(CONTROL)
			if (!element || element.disabled || element.getAttribute('aria-disabled') === 'true' || !helpFor(element)) return
			const noSelect = !event.target.closest('input, textarea, select, [contenteditable="true"]')
			if (noSelect) element.classList.add(s.touchTarget)
			touch = { pointerId: event.pointerId, element, x: event.clientX, y: event.clientY, shown: false, noSelect, timer: null }
			const currentTouch = touch
			currentTouch.timer = window.setTimeout(() => {
				if (touch !== currentTouch) return
				currentTouch.shown = true
				show(element, true)
			}, TOUCH_HOLD_MS)
		}
		const onPointerMove = event => {
			if (!touch || event.pointerId !== touch.pointerId) return
			if (Math.hypot(event.clientX - touch.x, event.clientY - touch.y) <= TOUCH_MOVE_LIMIT_PX) return
			clearTouch()
			hide()
		}
		const onPointerUp = event => {
			if (!touch || event.pointerId !== touch.pointerId) return
			if (touch.shown) {
				suppressClickFor = touch.element
				suppressClickUntil = Date.now() + 1200
			}
			clearTouch()
		}
		const onPointerCancel = event => {
			if (!touch || event.pointerId !== touch.pointerId) return
			clearTouch()
			hide()
		}
		const onClick = event => {
			if (!suppressClickFor || Date.now() > suppressClickUntil) return
			if (!(event.target instanceof Node) || !suppressClickFor.contains(event.target)) return
			event.preventDefault()
			event.stopImmediatePropagation()
			suppressClickFor = null
		}
		const onContextMenu = event => {
			if (touch?.noSelect && event.target instanceof Node && touch.element.contains(event.target)) event.preventDefault()
		}
		const onFocusIn = event => {
			if (inputMode === 'keyboard' && event.target instanceof Element) show(event.target.closest(CONTROL))
		}
		const onFocusOut = () => { if (inputMode === 'keyboard') hide() }
		const onKeyDown = event => {
			if (event.key === 'Escape') hide()
			else inputMode = 'keyboard'
		}
		const onScroll = () => {
			clearTouch()
			hide()
		}
		document.addEventListener('pointerover', onPointerOver)
		document.addEventListener('pointerout', onPointerOut)
		document.addEventListener('pointerdown', onPointerDown)
		document.addEventListener('pointermove', onPointerMove)
		document.addEventListener('pointerup', onPointerUp)
		document.addEventListener('pointercancel', onPointerCancel)
		document.addEventListener('click', onClick, true)
		document.addEventListener('contextmenu', onContextMenu)
		document.addEventListener('focusin', onFocusIn)
		document.addEventListener('focusout', onFocusOut)
		document.addEventListener('keydown', onKeyDown)
		window.addEventListener('scroll', onScroll, true)
		window.addEventListener('resize', hide)
		return () => {
			clearHover()
			clearTouch()
			if (activeElement && nativeTitle !== null) activeElement.setAttribute('title', nativeTitle)
			document.removeEventListener('pointerover', onPointerOver)
			document.removeEventListener('pointerout', onPointerOut)
			document.removeEventListener('pointerdown', onPointerDown)
			document.removeEventListener('pointermove', onPointerMove)
			document.removeEventListener('pointerup', onPointerUp)
			document.removeEventListener('pointercancel', onPointerCancel)
			document.removeEventListener('click', onClick, true)
			document.removeEventListener('contextmenu', onContextMenu)
			document.removeEventListener('focusin', onFocusIn)
			document.removeEventListener('focusout', onFocusOut)
			document.removeEventListener('keydown', onKeyDown)
			window.removeEventListener('scroll', onScroll, true)
			window.removeEventListener('resize', hide)
		}
	}, [])

	return tooltip && <div key={tooltip.id} className={s.tooltip} role="tooltip"
		style={{ left: tooltip.x, top: tooltip.above ? tooltip.top : tooltip.y,
			transform: tooltip.above ? 'translate(-50%, -100%)' : 'translateX(-50%)',
			'--tooltip-enter-y': tooltip.above ? '.4rem' : '-.4rem' }}>
		{tooltip.text}
	</div>
}

export default HelpTooltip
