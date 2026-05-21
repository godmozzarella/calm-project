import s from './DayBar.module.scss'

const WEEKDAYS = [
	'Воскресенье',
	'Понедельник',
	'Вторник',
	'Среда',
	'Четверг',
	'Пятница',
	'Суббота'
]

const MONTHS = [
	'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
	'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
]

const formatToday = (date = new Date()) =>
	`${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`

const DayBar = () => {
	return <div className={s.dayBar}>{formatToday()}</div>
}

export default DayBar
