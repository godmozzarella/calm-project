import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import s from './TouchTooltip.module.scss'

const controls = 'button, a[href], summary, [role="button"], [role="switch"]'
const controlAt = event => event.target instanceof Element ? event.target.closest(controls) : null

export default function TouchTooltip() {
	const [hint, setHint] = useState(null)
	const bubble = useRef(null)

	useEffect(() => {
		let press
		let suppressedClick
		let delay, dismiss

		const resetPress = () => {
			window.clearTimeout(delay)
			press = null
		}
		const hide = () => {
			resetPress()
			window.clearTimeout(dismiss)
			setHint(null)
		}
		const down = event => {
			hide()
			suppressedClick = null
			if (event.pointerType !== 'touch' || !event.isPrimary) return
			const control = controlAt(event)
			const title = (control?.getAttribute('title') || control?.querySelector(':scope > title')?.textContent || control?.getAttribute('aria-label'))?.trim()
			if (!title) return
			press = { control, id: event.pointerId, x: event.clientX, y: event.clientY }
			delay = window.setTimeout(() => {
				if (!control.isConnected) return
				suppressedClick = control
				setHint({ control, title })
			}, 500)
		}
		const move = event => {
			if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) hide()
		}
		const up = event => {
			if (press?.id !== event.pointerId) return
			resetPress()
			if (suppressedClick) dismiss = window.setTimeout(hide, 2200)
		}
		const click = event => {
			if (!suppressedClick || controlAt(event) !== suppressedClick || (event.detail === 0 && event.pointerType !== 'touch')) return
			event.preventDefault()
			event.stopPropagation()
			suppressedClick = null
		}
		const contextMenu = event => {
			const control = controlAt(event)
			if (control && (control === press?.control || control === suppressedClick)) event.preventDefault()
		}
		const listeners = {
			pointerdown: down,
			pointermove: move,
			pointerup: up,
			pointercancel: hide,
			click,
			contextmenu: contextMenu,
			scroll: hide,
		}
		for (const [event, handler] of Object.entries(listeners)) document.addEventListener(event, handler, true)
		window.addEventListener('resize', hide)
		return () => {
			for (const [event, handler] of Object.entries(listeners)) document.removeEventListener(event, handler, true)
			window.removeEventListener('resize', hide)
			window.clearTimeout(delay)
			window.clearTimeout(dismiss)
		}
	}, [])

	useLayoutEffect(() => {
		if (!hint) return
		const element = bubble.current
		if (element.showPopover) element.showPopover()
		const anchor = hint.control.getBoundingClientRect()
		const { width, height } = element.getBoundingClientRect()
		const left = Math.max(8, Math.min(anchor.left + (anchor.width - width) / 2, window.innerWidth - width - 8))
		const top = anchor.top >= height + 12 ? anchor.top - height - 8 : anchor.bottom + 8
		element.style.left = `${left}px`
		element.style.top = `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`
		return () => { if (element.hidePopover && element.matches(':popover-open')) element.hidePopover() }
	}, [hint])

	if (!hint) return null
	const container = hint.control.closest('dialog[open]') || document.body
	return createPortal(
		<div ref={bubble} popover="manual" className={s.bubble} aria-hidden="true">{hint.title}</div>,
		container,
	)
}
