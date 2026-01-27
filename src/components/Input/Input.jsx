// import s from './IndexPage.module.scss'

const Input = (props) =>{

	const {
		id,
		className = '',
		placeholder

	} = props;

	return(
		<input 
			id={id} 
			className={`${className}`} 
			action=""
			placeholder={placeholder}
		/>
	);
}

export default Input