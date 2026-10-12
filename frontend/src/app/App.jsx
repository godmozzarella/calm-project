import { useEffect } from 'react'
import ScrollToTop from '@/app/providers/router/ScrollToTop'
import AppRouter from '@/app/providers/router/AppRouter'
import { DictionariesProvider } from '@/shared/lib/dictionaries'
import { expireSessionIfIdle, getToken, http } from '@/shared/api/httpClient'
import { touchSession } from '@/shared/lib/sessionActivity'

const App = () => {
	useEffect(() => {
		let lastHeartbeat = 0
		const check = () => expireSessionIfIdle()
		const onActivity = () => {
			if (getToken() && !check()) {
				touchSession()
				const now = Date.now()
				if (now - lastHeartbeat >= 60_000) {
					lastHeartbeat = now
					void http.post('/auth/activity', {}).catch(() => {})
				}
			}
		}
		const onVisible = () => {
			if (document.visibilityState === 'visible') check()
		}

		check()
		const timer = window.setInterval(check, 15_000)
		window.addEventListener('pointerdown', onActivity)
		window.addEventListener('keydown', onActivity)
		window.addEventListener('wheel', onActivity, { passive: true })
		window.addEventListener('touchmove', onActivity, { passive: true })
		window.addEventListener('focus', check)
		document.addEventListener('visibilitychange', onVisible)
		return () => {
			window.clearInterval(timer)
			window.removeEventListener('pointerdown', onActivity)
			window.removeEventListener('keydown', onActivity)
			window.removeEventListener('wheel', onActivity)
			window.removeEventListener('touchmove', onActivity)
			window.removeEventListener('focus', check)
			document.removeEventListener('visibilitychange', onVisible)
		}
	}, [])

	return (
		<DictionariesProvider>
			<ScrollToTop />
			<AppRouter />
		</DictionariesProvider>
	)
}

export default App
