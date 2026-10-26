import { useEffect } from 'react'

let activeLocks = 0
let previousBodyOverflow = ''
let previousRootOverflow = ''

/**
 * Блокирует прокрутку страницы, пока хотя бы одна панель или форма открыта.
 */
export const useBodyScrollLock = active => {
	useEffect(() => {
		if (!active) return
		if (activeLocks === 0) {
			previousBodyOverflow = document.body.style.overflow
			previousRootOverflow = document.documentElement.style.overflow
			document.body.style.overflow = 'hidden'
			document.documentElement.style.overflow = 'hidden'
		}
		activeLocks += 1
		return () => {
			activeLocks -= 1
			if (activeLocks === 0) {
				document.body.style.overflow = previousBodyOverflow
				document.documentElement.style.overflow = previousRootOverflow
			}
		}
	}, [active])
}
