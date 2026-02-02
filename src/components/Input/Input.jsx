import s from './Input.module.scss'

const Input = (props) =>{

	const {
		id,
		type,
		placeholder,
		value,
		onChange,
	} = props;

	return(
		<input 
			classname={s.input}
			id={id} 
			placeholder={placeholder}
			type={type}
			value={value}
			onChange={onChange}
		/>
	);
}

export default Input