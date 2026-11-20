import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { resetViewportScroll } from '@/shared/lib/resetViewportScroll'

export default function ScrollToTop() {
	const { pathname, state, hash } = useLocation()
	const restoringChart = state?.scrollToChart === true
	const scrollToSection = state?.scrollToSection ?? (hash === '#regAndLog' ? 'regAndLog' : undefined)

	useLayoutEffect(() => {
		if (scrollToSection && pathname === '/') {
			const frame = window.requestAnimationFrame(() => {
				document.getElementById(scrollToSection)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
			})
			return () => window.cancelAnimationFrame(frame)
		}
		if (restoringChart) return

		resetViewportScroll()
		let settleFrame = 0
		const frame = window.requestAnimationFrame(() => {
			resetViewportScroll()
			settleFrame = window.requestAnimationFrame(resetViewportScroll)
		})
		return () => {
			window.cancelAnimationFrame(frame)
			window.cancelAnimationFrame(settleFrame)
		}
	}, [pathname, restoringChart, scrollToSection])

	return null
}
