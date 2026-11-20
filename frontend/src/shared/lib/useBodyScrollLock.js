import { useEffect } from 'react'

let activeLocks = 0
let fixedLocks = 0
let previousBodyOverflow = ''
let previousRootOverflow = ''
let frozenPage = null

/**
 * Блокирует прокрутку страницы, пока хотя бы одна панель или форма открыта.
 */
export const useBodyScrollLock = (active, { freezePosition = false } = {}) => {
	useEffect(() => {
		if (!active) return
		const { body, documentElement: root } = document
		if (freezePosition) {
			if (fixedLocks === 0) {
				const { position, top, left, right } = body.style
				frozenPage = { x: window.scrollX, y: window.scrollY, styles: { position, top, left, right } }
				Object.assign(body.style, { position: 'fixed', top: `${-frozenPage.y}px`, left: '0', right: '0' })
			}
			fixedLocks += 1
		}
		if (activeLocks === 0) {
			previousBodyOverflow = body.style.overflow
			previousRootOverflow = root.style.overflow
			body.style.overflow = 'hidden'
			root.style.overflow = 'hidden'
		}
		activeLocks += 1
		return () => {
			activeLocks -= 1
			if (activeLocks === 0) {
				body.style.overflow = previousBodyOverflow
				root.style.overflow = previousRootOverflow
			}
			if (freezePosition) {
				fixedLocks -= 1
				if (fixedLocks === 0) {
					const { x, y, styles } = frozenPage
					frozenPage = null
					Object.assign(body.style, styles)
					window.scrollTo({ left: x, top: y, behavior: 'instant' })
				}
			}
		}
	}, [active, freezePosition])
}
