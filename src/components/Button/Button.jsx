import s from './Button.module.scss'

const Button = (props) =>{
const {
	type,
	className,
	onClick,
	colored = false,
	children,
	sText = false,
	icon
} = props;

	return(
		<button 
		type={type}
			onClick={onClick} 
			className={`${colored ? s.colored : className}`}>			
			{children && <span className={sText ? s.sText : s.mText}>{children}</span>}
			{icon && <span className={s.icon}>{icon}</span>}
		</button>
	);
}

export default Button