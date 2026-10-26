import { createContext, useContext } from 'react'

export const ThemeContext = createContext(null)

export const useTheme = () => {
	const context = useContext(ThemeContext)
	if (!context) throw new Error('useTheme must be used inside ThemeProvider')
	return context
}
