import s from './SidebarCalendar.module.scss'

const SidebarCalendar = (props) => {
    const { 
        openCalendar, 
        setOpenCalendar,
        closeIcon
    } = props;

    return (
        <>
            <div className={`${s.calendarSidebar} ${openCalendar ? s.active : ""}`}>
					<span className={s.close} onClick={() => setOpenCalendar(false)}>{closeIcon}</span>
					<div className={s.list}>
						
					</div>
				</div>
				{openCalendar && <div className={s.overlay} onClick={() => setOpenCalendar(false)} />}
        </>
    )
}

export default SidebarCalendar