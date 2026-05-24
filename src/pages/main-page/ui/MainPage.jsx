import { useEffect, useState } from 'react'

import { SidebarProfile } from '@/widgets/sidebar-profile'
import { SidebarCalendar } from '@/widgets/sidebar-calendar'
import { MainSection } from '@/widgets/main-section'
import { Button } from '@/shared/ui/Button'
import { CalendarMonthIcon, MenuIcon } from '@/shared/ui/icons'
import { getCurrentUser } from '@/entities/user'

import s from './MainPage.module.scss'

const MainPage = () => {
	const [openMenu, setOpenMenu] = useState(false)
	const [openCalendar, setOpenCalendar] = useState(false)
	const [user, setUser] = useState(null)

	useEffect(() => {
		setUser(getCurrentUser())
	}, [])

	if (!user) {
		return <p>Пользователь не авторизован</p>
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

			<MainSection />
		</div>
	)
}

export default MainPage
