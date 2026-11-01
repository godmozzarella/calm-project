import s from './SectionBlock.module.scss'

const SectionBlock = props => {
	const { colored = false, icon, title, description, className = '' } = props

	return (
		<div className={`${colored ? s.coloredBlock : s.block} ${className}`}>
			{icon && <span className={s.icon}>{icon}</span>}
			{title && <h2 className={s.title}>{title}</h2>}
			{description && (
				<p className={colored ? s.coloredDescription : s.description}>
					{description}
				</p>
			)}
		</div>
	)
}

export default SectionBlock
