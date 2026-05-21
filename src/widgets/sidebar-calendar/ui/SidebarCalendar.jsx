import { CloseIcon } from '@/shared/ui/icons'

import s from './SidebarCalendar.module.scss'

const SidebarCalendar = props => {
	const { openCalendar, setOpenCalendar } = props

	return (
		<>
			<div
				className={`${s.calendarSidebar} ${openCalendar ? s.active : ''}`}
			>
				<span
					className={s.close}
					onClick={() => setOpenCalendar(false)}
				>
					<CloseIcon />
				</span>
				<div className={s.list} />
			</div>
			{openCalendar && (
				<div className={s.overlay} onClick={() => setOpenCalendar(false)} />
			)}
		</>
	)
}

export default SidebarCalendar
