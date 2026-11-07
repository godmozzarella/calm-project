const pad = value => String(value).padStart(2, '0')
const minuteOfDay = value => {
	const [hours, minutes] = value.split(':').map(Number)
	return hours * 60 + minutes
}

export const localMinute = (instant = new Date()) => ({
	date: `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`,
	time: `${pad(instant.getHours())}:${pad(instant.getMinutes())}`,
})

export const isFutureLocalMinute = (date, time, current = localMinute()) =>
	date > current.date || (date === current.date && minuteOfDay(time) > minuteOfDay(current.time))
