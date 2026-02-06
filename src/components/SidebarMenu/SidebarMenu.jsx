import s from './SidebarMenu.module.scss'

const SidebarMenu = (props) => {

	const { 
			openMenu, 
			setOpenMenu,
			closeIcon
		} = props;

    return (
        <>
          {/* боковое меню */}
					<div className={`${s.sidebar} ${openMenu ? s.active : ""}`}>
						<span className={s.close} onClick={() => setOpenMenu(false)}>{closeIcon}</span>
						<div className={s.list}>
			
							<a href="#">Профиль</a>  
							<div className={s.profileIcon}>
								<img src="/profile.png" alt="Profile" />
							</div>
							<a href="#">Статистика</a>  
							<a href="#">Настройки</a>  
						</div>
							
					</div>
					{openMenu && <div className={s.overlay} onClick={() => setOpenMenu(false)} />}
        </>
    )
}

export default SidebarMenu