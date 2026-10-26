import { Button } from '@/shared/ui/Button'
import {
	InstagramIcon,
	LanguageIcon,
	TelegramIcon,
	XIcon,
	YouTubeIcon,
	DarkModeOutlinedIcon,
	LightModeOutlinedIcon,
} from '@/shared/ui/icons'
import { useTheme } from '@/app/providers/theme/themeContext'

import s from './Footer.module.scss'

const Footer = () => {
	const { theme, toggleTheme } = useTheme()
	return (
		<div className={s.footerRoot} id="contacts">
		<footer>
			<div className={s.item1}>
				<div className={s.logoBlock}>
					<a className={s.logo} href="#">Calm</a>
					<p className={s.slogan}>Отслеживай. Понимай. Живи легче!</p>
					<p className={s.tagline}>
						Личный дневник головной боли с аналитикой паттернов и экспортом для врача.
					</p>
				</div>

				<div className={s.linksGrid}>
					<div className={s.linkCol}>
						<h4 className={s.colTitle}>Помощь</h4>
						<ul>
							<li><a href="#">FAQ</a></li>
							<li><a href="#">Как пользоваться</a></li>
							<li><a href="#">О заболевании</a></li>
						</ul>
					</div>

					<div className={s.linkCol}>
						<h4 className={s.colTitle}>Связь</h4>
						<ul>
							<li><a href="mailto:calm-prj@gmail.com">calm-prj@gmail.com</a></li>
							<li><a href="#">Поддержка</a></li>
							<li><a href="#">Сотрудничество</a></li>
						</ul>
					</div>

					<div className={s.glowBlock} aria-hidden="true" />
				</div>
			</div>

			<hr />

			<div className={s.item2}>
				<div className={s.bottomLeft}>
					<div className={s.localeThemeControls}>
					<Button
						sText
						icon={<LanguageIcon />}
						className={s.languageButton}
					>
						Русский
					</Button>
					<button className={s.themeButton} type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}>
						{theme === 'dark' ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
					</button>
					</div>
					<p className={s.copyright}>
						2026 &copy; Calm — сервис отслеживания и анализа головной боли
					</p>
				</div>
				<ul className={s.socials}>
					<li><a className={s.socialLink} href="#" aria-label="Telegram"><TelegramIcon /></a></li>
					<li><a className={s.socialLink} href="#" aria-label="X"><XIcon /></a></li>
					<li><a className={s.socialLink} href="#" aria-label="YouTube"><YouTubeIcon /></a></li>
					<li><a className={s.socialLink} href="#" aria-label="Instagram"><InstagramIcon /></a></li>
				</ul>
			</div>
		</footer>
		</div>
	)
}

export default Footer
