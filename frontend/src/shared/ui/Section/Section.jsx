import s from './Section.module.scss'

const Section = props => {
	const { id, title, colored = false, children, className = '', blocksClassName = '' } = props

	return (
		<section id={id} className={`${colored ? s.colored : ''} ${className}`}>
			<div className={s.container}>
				{title && <h1 className={s.title}>{title}</h1>}
				<div className={`${s.blocks} ${blocksClassName}`}>{children}</div>
			</div>
		</section>
	)
}

export default Section
