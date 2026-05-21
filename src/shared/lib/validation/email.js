const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isValidEmail = value => EMAIL_REGEX.test(value)

export const validateEmail = value => {
	if (!value) return ''
	return isValidEmail(value) ? '' : 'Некорректный email'
}
