import s from './SidebarCalendar.module.scss'
import {CloseIcon} from '../../assets/icons';

const SidebarCalendar = (props) => {
    const { 
        openCalendar, 
        setOpenCalendar,
    } = props;

    return (
        <>
            <div className={`${s.calendarSidebar} ${openCalendar ? s.active : ""}`}>
					<span className={s.close} onClick={() => setOpenCalendar(false)}>{<CloseIcon />}</span>
					<div className={s.list}>
						
					</div>
				</div>
				{openCalendar && <div className={s.overlay} onClick={() => setOpenCalendar(false)} />}
        </>
    )
}

export default SidebarCalendar