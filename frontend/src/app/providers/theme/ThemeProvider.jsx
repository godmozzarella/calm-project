import { useEffect, useMemo, useState } from 'react'
import { ThemeContext } from './themeContext'

const THEME_KEY = 'calm_theme'
const getInitialTheme = () => {
	try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark' }
	catch { return 'dark' }
}

export const ThemeProvider = ({ children }) => {
	const [theme, setTheme] = useState(getInitialTheme)
	useEffect(() => {
		document.documentElement.dataset.theme = theme
		try { localStorage.setItem(THEME_KEY, theme) } catch { /* Keep the selected theme for this session. */ }
	}, [theme])
	const value = useMemo(() => ({ theme, toggleTheme: () => setTheme(current => current === 'dark' ? 'light' : 'dark') }), [theme])
	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
