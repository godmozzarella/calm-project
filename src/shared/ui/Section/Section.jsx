import s from './Section.module.scss'

const Section = props => {
	const { id, title, colored = false, children } = props

	return (
		<section id={id} className={colored ? s.colored : ''}>
			<div className={s.container}>
				{title && <h1 className={s.title}>{title}</h1>}
				<div className={s.blocks}>{children}</div>
			</div>
		</section>
	)
}

export default Section
