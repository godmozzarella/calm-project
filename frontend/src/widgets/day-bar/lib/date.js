export const midnight = (d = new Date()) => {
	const copy = new Date(d)
	copy.setHours(0, 0, 0, 0)
	return copy
}

export const dateKey = d =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
