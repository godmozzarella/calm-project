import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/Button'
import { CloseIcon, MenuIcon } from '@/shared/ui/icons'

import s from './Header.module.scss'

const Header = () => {
	const [hidden, setHidden] = useState(false)
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
	const mobileNavigationRef = useRef(null)
	const location = useLocation()
	const navigate = useNavigate()

	useEffect(() => {
		let previousY = window.scrollY
		const onScroll = () => {
			const currentY = window.scrollY
			if (currentY <= 48) {
				setHidden(false)
				previousY = currentY
				return
			}
			const delta = currentY - previousY
			if (Math.abs(delta) < 4) return
			setHidden(delta > 0)
			if (delta > 0) setMobileMenuOpen(false)
			previousY = currentY
		}
		window.addEventListener('scroll', onScroll, { passive: true })
		return () => window.removeEventListener('scroll', onScroll)
	}, [])

	useEffect(() => {
		if (!mobileMenuOpen) return undefined
		const onPointerDown = event => {
			if (!mobileNavigationRef.current?.contains(event.target)) setMobileMenuOpen(false)
		}
		const onKeyDown = event => {
			if (event.key === 'Escape') setMobileMenuOpen(false)
		}
		document.addEventListener('pointerdown', onPointerDown)
		document.addEventListener('keydown', onKeyDown)
		return () => {
			document.removeEventListener('pointerdown', onPointerDown)
			document.removeEventListener('keydown', onKeyDown)
		}
	}, [mobileMenuOpen])

	const navigateToSection = (event, id) => {
		event.preventDefault()
		setMobileMenuOpen(false)
		if (location.pathname === '/') {
			document.getElementById(id)?.scrollIntoView({ block: id === 'contacts' ? 'end' : 'start', behavior: 'smooth' })
		} else if (id === 'contacts') {
			document.getElementById(id)?.scrollIntoView({ block: 'end', behavior: 'smooth' })
		} else {
			navigate('/', { state: { scrollToSection: id } })
		}
	}

	return (
		<header className={`${s.header} ${hidden ? s.hidden : ''}`} inert={hidden}>
			<Link className={s.logo} to="/">
				Calm
			</Link>
			<nav>
				<span className={s.tagline}>
					<a href="#for_who" onClick={event => navigateToSection(event, 'for_who')}>Для кого</a>
					<a href="#about" onClick={event => navigateToSection(event, 'about')}>Как пользоваться</a>
					<a href="#data-protection" onClick={event => navigateToSection(event, 'data-protection')}>Данные под защитой</a>
					<a href="#contacts" onClick={event => navigateToSection(event, 'contacts')}>Контакты</a>
				</span>
				<div className={s.mobileNavigation} ref={mobileNavigationRef}>
					<button
						type="button"
						className={s.mobileMenuButton}
						aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
						aria-expanded={mobileMenuOpen}
						aria-controls="calm-mobile-navigation"
						onClick={() => setMobileMenuOpen(open => !open)}
					>
						{mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
					</button>
					{mobileMenuOpen && <div id="calm-mobile-navigation" className={s.mobileDropdown}>
						<a href="#for_who" onClick={event => navigateToSection(event, 'for_who')}>Для кого</a>
						<a href="#about" onClick={event => navigateToSection(event, 'about')}>Как пользоваться</a>
						<a href="#data-protection" onClick={event => navigateToSection(event, 'data-protection')}>Данные под защитой</a>
						<a href="#contacts" onClick={event => navigateToSection(event, 'contacts')}>Контакты</a>
					</div>}
				</div>

				<Button
					onClick={() => location.pathname === '/'
						? document.getElementById('regAndLog')?.scrollIntoView()
						: navigate('/', { state: { scrollToSection: 'regAndLog' } })}
					colored
				>
					Начни сейчас!
				</Button>
			</nav>
		</header>
	)
}

export default Header
