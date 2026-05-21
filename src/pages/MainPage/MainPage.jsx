import Footer from '../../widgets/Footer/Footer'

import { CalendarMonthIcon, MenuIcon } from '../../assets/icons'
import { useState, useEffect } from 'react'

import SidebarProfile from '../../widgets/SidebarProfile/SidebarProfile'
import SidebarCalendar from '../../widgets/SidebarCalendar/SidebarCalendar'
import MainSection from '../../widgets/MainSection/MainSection'
import Button from '../../shared/Button/Button'

import s from './MainPage.module.scss'

const MainPage = () => {

	const [openMenu, setOpenMenu] = useState(false);
	const [openCalendar, setOpenCalendar] = useState(false)

	 const [user, setUser] = useState(null);

    useEffect(() => {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        setUser(currentUser);
    }, []);

    if (!user) {
        return <p>Пользователь не авторизован</p>;
    }

	return (
		<div className={s.mainPage}>

			<Button
				className={`${s.icon} ${s.menu}`}
				icon={<MenuIcon />}
				onClick={() => setOpenMenu(!openMenu)}
			/>

			<Button
				className={`${s.icon} ${s.calendar}`}
				icon={<CalendarMonthIcon />}
				onClick={() => setOpenCalendar(!openCalendar)}
			/>
			
			{/* боковое меню */}
			<SidebarProfile 
				openMenu={openMenu} 
				setOpenMenu={setOpenMenu} 
				user={user} 
				setUser={setUser}
			/> 

			{/* //календарь */}
			<SidebarCalendar 
				openCalendar={openCalendar} 
				setOpenCalendar={setOpenCalendar} 
			/>
			
			<MainSection />

			<Footer />
		</div>
	)
}

export default MainPage
