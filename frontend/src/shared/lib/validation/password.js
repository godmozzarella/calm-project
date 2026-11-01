const PASSWORD_RULES = [
	{ regex: /.{8,}/, message: 'не менее 8 символов' },
	{ regex: /[a-z]/, message: 'строчную букву' },
	{ regex: /[A-Z]/, message: 'заглавную букву' },
	{ regex: /\d/, message: 'цифру' }
]

export const PASSWORD_PATTERN =
	'^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$'

export const validatePassword = value => {
	if (!value) return ''
	if (new TextEncoder().encode(value).length > 72) return 'Пароль слишком длинный: максимум 72 байта UTF-8'
	const failed = PASSWORD_RULES.find(rule => !rule.regex.test(value))
	return failed ? `Пароль должен содержать ${failed.message}` : ''
}
