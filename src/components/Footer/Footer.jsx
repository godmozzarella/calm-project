import {Link} from 'react-router-dom'
import Button from '../Button/Button'

import s from  './Footer.module.scss'

import {
	InstagramIcon,
	LanguageIcon,
	TelegramIcon,
	XIcon,
	YouTubeIcon
} from '../../assets/icons'

const Footer = () =>{
	return (
		<footer id={s.contacts}>
			<div className={s.item1}>
				<div className={s.logoBlock}>
					<a className= {s.logo} href="#">Calm</a>
					<p className={s.slogan}>Отслеживай. Понимай. Живи легче!</p>
				</div>
				<ul>
					<li><a href="">Для кого</a></li>
					<li><a href="">О проекте</a></li>
					<li><a href="">Политика</a></li>
				</ul>
			</div>
			<hr />
			<div className={s.item2}>
				<div className={s.bottomLeft}>
					<Button 
						children={<>Русский	</>}
						icon={<LanguageIcon />}
					/>
					<p className={s.copyright}>
						2026 &copy; Calm — сервис отслеживания и анализа головной боли{' '}
					</p>
				</div>
				<ul>
					<li><a href="#"><TelegramIcon /></a></li>
					<li><a href="#"><XIcon /></a></li>
					<li><a href="#"><YouTubeIcon /></a></li>
					<li><Link to="/main"><InstagramIcon /></Link></li>
				</ul>
			</div>
		</footer>
	)
}

export default Footer
