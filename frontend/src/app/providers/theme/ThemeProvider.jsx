import { useEffect, useMemo, useState } from 'react'
import { ThemeContext } from './themeContext'

const THEME_KEY = 'calm_theme'
const THEME_PREFERENCES = ['dark', 'light', 'auto']
const getInitialThemePreference = () => {
	try {
		const preference = localStorage.getItem(THEME_KEY)
		return THEME_PREFERENCES.includes(preference) ? preference : 'dark'
	} catch { return 'dark' }
}
const getSystemTheme = () => window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'

export const ThemeProvider = ({ children }) => {
	const [themePreference, setThemePreference] = useState(getInitialThemePreference)
	const [systemTheme, setSystemTheme] = useState(getSystemTheme)
	const theme = themePreference === 'auto' ? systemTheme : themePreference

	useEffect(() => {
		const mediaQuery = window.matchMedia?.('(prefers-color-scheme: light)')
		if (!mediaQuery) return undefined
		const updateSystemTheme = event => setSystemTheme(event.matches ? 'light' : 'dark')
		mediaQuery.addEventListener('change', updateSystemTheme)
		return () => mediaQuery.removeEventListener('change', updateSystemTheme)
	}, [])

	useEffect(() => {
		document.documentElement.dataset.theme = theme
	}, [theme])

	useEffect(() => {
		try { localStorage.setItem(THEME_KEY, themePreference) } catch { /* Keep the selected theme for this session. */ }
	}, [themePreference])

	const value = useMemo(() => ({
		theme,
		themePreference,
		setThemePreference,
		toggleTheme: () => setThemePreference(current => (current === 'auto' ? systemTheme : current) === 'dark' ? 'light' : 'dark'),
	}), [theme, themePreference, systemTheme])
	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
