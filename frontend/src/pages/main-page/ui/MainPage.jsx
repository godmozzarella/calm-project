import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { SidebarProfile } from '@/widgets/sidebar-profile'
import { SidebarCalendar } from '@/widgets/sidebar-calendar'
import { MainSection } from '@/widgets/main-section'
import { Button } from '@/shared/ui/Button'
import { CalendarMonthIcon, MenuIcon } from '@/shared/ui/icons'
import { getCurrentUser, setCurrentUser } from '@/entities/user'
import { userApi, getToken } from '@/shared/api'
import { LocationOnboarding } from '@/features/onboarding-location'

import s from './MainPage.module.scss'

const MainPage = () => {
	const [openMenu, setOpenMenu] = useState(false)
	const [openCalendar, setOpenCalendar] = useState(false)
	// Ленивая инициализация: сразу читаем из localStorage, чтобы не было мигания
	// «не авторизован» между первым рендером и useEffect.
	const [user, setUser] = useState(() => getCurrentUser())
	const [showLocationOnboarding, setShowLocationOnboarding] = useState(false)
	const [onboardingDismissed, setOnboardingDismissed] = useState(false)

	const hasToken = !!getToken()

	useEffect(() => {
		if (!hasToken) return
		userApi.getMe().then(fresh => {
			setUser(fresh)
			setCurrentUser(fresh)
		}).catch(() => {})
	}, [hasToken])

	useEffect(() => {
		if (!user || onboardingDismissed) return
		if (user.latitude == null || user.longitude == null) {
			setShowLocationOnboarding(true)
		}
	}, [user, onboardingDismissed])

	if (!hasToken) {
		return <Navigate to="/" replace />
	}

	if (!user) {
		return null
	}

	return (
		<div className={s.mainPage}>
			<Button
				className={`${s.icon} ${s.menu}`}
				icon={<MenuIcon />}
				onClick={() => setOpenMenu(prev => !prev)}
			/>

			<Button
				className={`${s.icon} ${s.calendar}`}
				icon={<CalendarMonthIcon />}
				onClick={() => setOpenCalendar(prev => !prev)}
			/>

			<SidebarProfile
				openMenu={openMenu}
				setOpenMenu={setOpenMenu}
				user={user}
				setUser={setUser}
			/>

			<SidebarCalendar
				openCalendar={openCalendar}
				setOpenCalendar={setOpenCalendar}
			/>

			<MainSection user={user} />

			<LocationOnboarding
				open={showLocationOnboarding}
				onClose={() => {
					setShowLocationOnboarding(false)
					setOnboardingDismissed(true)
				}}
				setUser={setUser}
			/>
		</div>
	)
}

export default MainPage
