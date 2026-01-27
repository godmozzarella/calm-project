import Button from '../Button/Button'
import s from './Header.module.scss'

const Header = () =>{
	return (
		<header>
			<a className={s.logo} href="#">
				Calm
			</a>
			<nav>
				<span className={s.tagline}>
					<a href="#for_who">Для кого</a>
					<a href="#about">О проекте</a>
					<a href="#benefits">Достоинства</a>
					<a href="#contacts">Контакты</a>
				</span>

				<Button
					onClick={() =>
						document
							.getElementById('regAndLog')
							?.scrollIntoView()
					}
					colored
					children={
						<p className={s.buttonText}>Используй <span className={s.inTextLogo}>Calm</span> уже сейчас!</p>
					}
				/>
			</nav>
		</header>
	)
}

export default Header
