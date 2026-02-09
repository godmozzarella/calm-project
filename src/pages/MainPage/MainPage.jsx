import Footer from '../../components/Footer/Footer'

import { Link } from 'react-router-dom'
import { CalendarMonthIcon, MenuIcon, CloseIcon } from '../../assets/icons'
import { useState, useEffect } from 'react'

import SidebarProfile from '../../components/SidebarProfile/SidebarProfile'
import SidebarCalendar from '../../components/SidebarCalendar/SidebarCalendar'
import MainSection from '../../components/MainSection/MainSection'
import Button from '../../components/Button/Button'

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
			<SidebarProfile openMenu={openMenu} setOpenMenu={setOpenMenu} closeIcon={<CloseIcon />} user={user}/>

			{/* //календарь */}
			<SidebarCalendar openCalendar={openCalendar} setOpenCalendar={setOpenCalendar} closeIcon={<CloseIcon />} />
			
			<MainSection />

			<Footer />
		</div>
	)
}

export default MainPage
