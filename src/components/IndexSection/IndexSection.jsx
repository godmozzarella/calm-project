import s from './IndexSection.module.scss'

const IndexSection = (props)=> {
	const{
		id,
		title,
		colored = false,
		children
	} = props;


	return (
		<section
			id={id}
			className={colored ? `${s.colored}` : ''}
		>
			<div className={s.container}>
				{title && <h1 className={s.title}>{title}</h1>}
				{children}
			</div>
		</section>
	)
}

export default IndexSection
