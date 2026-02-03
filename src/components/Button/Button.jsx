import s from './Button.module.scss'

const Button = (props) =>{
const {
	onClick,
	colored = false,
	children,
	sText = false,
	icon
} = props;

	return(
		<button 
			onClick={onClick} 
			className={colored ? `${s.colored}` : `${s.default}`}>			
			{children && <span className={sText ? s.sText : s.mText}>{children}</span>}
			<span className={s.icon}>{icon}</span>
		</button>
	);
}

export default Button