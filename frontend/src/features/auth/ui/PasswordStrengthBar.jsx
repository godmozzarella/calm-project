import s from './PasswordStrengthBar.module.scss'

const RULES = [
	/.{8,}/,
	/[a-z]/,
	/[A-Z]/,
	/\d/,
	/[#_@$!%*?&]/,
]

const LEVELS = [
	{ label: '', color: '' },
	{ label: 'Очень слабый', color: 'weak' },
	{ label: 'Слабый', color: 'weak' },
	{ label: 'Средний', color: 'medium' },
	{ label: 'Хороший', color: 'good' },
	{ label: 'Надёжный', color: 'strong' },
]

const getStrength = password => {
	if (!password) return 0
	return RULES.filter(r => r.test(password)).length
}

const PasswordStrengthBar = ({ password }) => {
	const strength = getStrength(password)

	if (!password) return null

	const level = LEVELS[strength]

	return (
		<div className={s.wrapper}>
			<div className={s.bars}>
				{RULES.map((_, i) => (
					<div
						key={i}
						className={`${s.bar} ${i < strength ? s[level.color] : ''}`}
					/>
				))}
			</div>
			{level.label && (
				<span className={`${s.label} ${s[level.color]}`}>{level.label}</span>
			)}
		</div>
	)
}

export default PasswordStrengthBar
