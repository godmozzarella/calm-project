import s from './Input.module.scss'

const Input = (props) =>{

	const {
		id,
		type,
		placeholder,
		value,
		onChange,
		pattern,
		className,
	} = props;

	return(
		<input 
			className={`${s.input} ${className}`}
			id={id} 
			placeholder={placeholder}
			type={type}
			value={value}
			onChange={onChange}
			pattern={pattern}
		/>
	);
}

export default Input