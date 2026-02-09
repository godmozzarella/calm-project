
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import s from './SidebarProfile.module.scss'

const SidebarProfile = (props) => {

	const { 
			openMenu, 
			setOpenMenu,
			closeIcon,
			user
		} = props;
		
		const navigate = useNavigate();
		
		useEffect(() => {
			const user = JSON.parse(localStorage.getItem("currentUser"));
			if (!user) navigate("/");
		}, [navigate]);

    return (
        <>
          {/* боковое меню */}
					<div className={`${s.sidebar} ${openMenu ? s.active : ""}`}>
						<span className={s.close} onClick={() => setOpenMenu(false)}>{closeIcon}</span>
						<div className={s.list}>
			
							<a href="#">Профиль</a>  
							<div className={s.profileIcon}>
								<img src={user?.avatar || "/profile.png"} alt="Profile" />
							</div>
							<p>{user?.name}</p>
							<p>{user?.email}</p>
							<a href="#">Статистика</a>  
							<a href="#">Настройки</a>  
						</div>
							
					</div>
					{openMenu && <div className={s.overlay} onClick={() => setOpenMenu(false)} />}
        </>
    )
}

export default SidebarProfile