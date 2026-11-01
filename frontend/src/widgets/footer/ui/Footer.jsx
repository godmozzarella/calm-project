import { useRef, useState } from 'react'
import ContrastIcon from '@mui/icons-material/Contrast'
import { Button } from '@/shared/ui/Button'
import {
	LanguageIcon,
	TelegramIcon,
	ThreadsIcon,
	GitHubIcon,
	DarkModeOutlinedIcon,
	LightModeOutlinedIcon,
	InstallMobileIcon,
} from '@/shared/ui/icons'
import { getInstallationGuide, useAppInstallation } from '@/shared/lib/appInstallation'
import { useTheme } from '@/app/providers/theme/themeContext'
import FooterHelpSheet from './FooterHelpSheet'
import { Link } from 'react-router-dom'

import s from './Footer.module.scss'

const Footer = () => {
	const { isInstalled, install } = useAppInstallation()
	const [installing, setInstalling] = useState(false)
	const { themePreference, setThemePreference } = useTheme()
	const themeSelectRef = useRef(null)
	const [openGuide, setOpenGuide] = useState(null)
	const installApp = async () => {
		if (installing) return
		setInstalling(true)
		try {
			if (!await install()) setOpenGuide(getInstallationGuide())
		} catch { setOpenGuide(getInstallationGuide()) }
		finally { setInstalling(false) }
	}
	const openThemeOptions = event => {
		if (event.target.closest('select')) return
		const select = themeSelectRef.current
		if (!select) return
		if (typeof select.showPicker === 'function') select.showPicker()
		else { select.focus(); select.click() }
	}
	const themeIcon = themePreference === 'auto'
		? <ContrastIcon fontSize="small" aria-hidden="true" />
		: themePreference === 'light' ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />
	return (
		<div className={s.footerRoot} id="contacts">
		<FooterHelpSheet topic={openGuide} onClose={setOpenGuide} />
		<footer>
			<div className={s.item1}>
				<div className={s.logoBlock}>
					<Link className={s.logo} to="/">Calm</Link>
					<p className={s.slogan}>Отслеживай. Понимай. Живи легче!</p>
					<p className={s.tagline}>
						Личный дневник головной боли с аналитикой паттернов и экспортом для врача.
					</p>
				</div>

				<div className={s.linksGrid}>
					<div className={s.linkCol}>
						<h4 className={s.colTitle}>Помощь</h4>
						<ul>
							<li><button type="button" className={s.textLink} onClick={() => setOpenGuide('faq')}>FAQ</button></li>
							<li><button type="button" className={s.textLink} onClick={() => setOpenGuide('how-to')}>Как пользоваться</button></li>
							<li><button type="button" className={s.textLink} onClick={() => setOpenGuide('condition')}>О заболевании</button></li>
							<li><Link to="/privacy-policy">Политика обработки данных</Link></li>
						</ul>
					</div>

					<div className={s.linkCol}>
						<h4 className={s.colTitle}>Связь</h4>
						<ul>
							<li><a href="mailto:calm.notifications.prj@gmail.com">calm.notifications.prj@gmail.com</a></li>
							<li><a href="mailto:calm.notifications.prj@gmail.com?subject=%D0%9F%D0%BE%D0%B4%D0%B4%D0%B5%D1%80%D0%B6%D0%BA%D0%B0">Поддержка</a></li>
							<li><a href="mailto:calm.notifications.prj@gmail.com?subject=%D0%A1%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D1%87%D0%B5%D1%81%D1%82%D0%B2%D0%BE">Сотрудничество</a></li>
						</ul>
					</div>

					<div className={s.glowBlock} aria-hidden="true" />
				</div>
			</div>

			<hr />

			<div className={s.item2}>
				<div className={s.bottomLeft}>
					<div className={s.localeThemeControls}>
					{!isInstalled && <Button sText icon={<InstallMobileIcon fontSize="small" />} className={s.installButton} onClick={installApp} disabled={installing}>Установить приложение</Button>}
					<Button
						sText
						icon={<LanguageIcon fontSize="small" />}
						className={s.languageButton}
					>
						Русский
					</Button>
					<div className={s.themeSelectWrap} onClick={openThemeOptions}>
						<select ref={themeSelectRef} className={s.themeSelect} aria-label="Тема оформления" value={themePreference} onChange={event => setThemePreference(event.target.value)}>
							<option value="auto">Авто</option>
							<option value="light">Светлая</option>
							<option value="dark">Тёмная</option>
						</select>
						{themeIcon}
					</div>
					</div>
					<p className={s.copyright}>
						2026 &copy; Calm — сервис отслеживания и анализа головной боли
					</p>
				</div>
				<ul className={s.socials}>
					<li><a className={s.socialLink} href="https://t.me/calm_prj" aria-label="Telegram"><TelegramIcon /></a></li>
					<li><a className={s.socialLink} href="https://www.threads.com/@calm.prj?igshid=NTc4MTIwNjQ2YQ==" aria-label="Threads"><ThreadsIcon /></a></li>
					<li><a className={s.socialLink} href="https://github.com/godmozzarella/calm-project" aria-label="GitHub"><GitHubIcon /></a></li>
				</ul>
			</div>
		</footer>
		</div>
	)
}

export default Footer
