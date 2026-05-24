import { useEffect } from 'react'

/**
 * Блокирует прокрутку document.body пока active === true.
 * Восстанавливает предыдущее значение overflow при деактивации.
 */
export const useBodyScrollLock = active => {
	useEffect(() => {
		if (!active) return
		const prev = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => { document.body.style.overflow = prev }
	}, [active])
}
