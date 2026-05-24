const PASSWORD_RULES = [
	{ regex: /.{8,}/, message: 'не менее 8 символов' },
	{ regex: /[a-z]/, message: 'строчную букву' },
	{ regex: /[A-Z]/, message: 'заглавную букву' },
	{ regex: /\d/, message: 'цифру' },
	{ regex: /[#_@$!%*?&]/, message: 'спецсимвол' }
]

export const PASSWORD_PATTERN =
	'^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[#_@$!%*?&])[A-Za-z\\d#_@$!%*?&]{8,}$'

export const validatePassword = value => {
	if (!value) return ''
	const failed = PASSWORD_RULES.find(rule => !rule.regex.test(value))
	return failed ? `Пароль должен содержать ${failed.message}` : ''
}
