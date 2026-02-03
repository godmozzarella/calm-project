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
		<footer id="contacts">
			<div className={s.item1}>
				<div className={s.logoBlock}>
					<a className= {s.logo} href="#">Calm</a>
					<p className={s.slogan}>Отслеживай. Понимай. Живи легче!</p>
				</div>
				<ul className={s.links}>
					<li><a href="">Для кого</a></li>
					<li><a href="">О проекте</a></li>
					<li><a href="">Политика</a></li>
				</ul>
			</div>
			<hr />
			<div className={s.item2}>
				<div className={s.bottomLeft}>
					<Button 
						children={<>Русский</>}
						sText
						icon={<LanguageIcon />}
					/>
					<p className={s.copyright}>
						2026 &copy; Calm — сервис отслеживания и анализа головной боли{' '}
					</p>
				</div>
				<ul	className={s.links}>
					<li><a className={s.socialLink} href="#"><TelegramIcon /></a></li>
					<li><a className={s.socialLink} href="#"><XIcon /></a></li>
					<li><a className={s.socialLink} href="#"><YouTubeIcon /></a></li>
					<li><a className={s.socialLink} href="#"><InstagramIcon /></a></li>
				</ul>
			</div>
		</footer>
	)
}

export default Footer
