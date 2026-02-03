import s from './Button.module.scss'

const Button = (props) =>{
const {
	onClick,
	colored = false,
	children,
	icon
} = props;

	return(
		<button 
			onClick={onClick} 
			className={colored ? `${s.colored}` : `${s.default}`}>			
			{children}
			<span className={s.icon}>{icon}</span>
		</button>
	);
}

export default Button