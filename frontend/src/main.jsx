import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from '@/app/App'
import '@/app/styles/main.scss'
import { initializeAppInstallation } from '@/shared/lib/appInstallation'

initializeAppInstallation()
if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'

try {
	const themePreference = localStorage.getItem('calm_theme')
	const systemIsLight = window.matchMedia?.('(prefers-color-scheme: light)').matches
	document.documentElement.dataset.theme = themePreference === 'light' || (themePreference === 'auto' && systemIsLight) ? 'light' : 'dark'
} catch {
	document.documentElement.dataset.theme = 'dark'
}

try {
	if (new URLSearchParams(window.location.search).get('streakPreview') === '1') {
		sessionStorage.setItem('calm_streak_preview', '1')
	}
} catch { /* The streak preview is optional when session storage is unavailable. */ }

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</StrictMode>
)
