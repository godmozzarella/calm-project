const KEY = 'calm_zones'
const read = () => JSON.parse(localStorage.getItem(KEY) ?? '{}')
const write = data => localStorage.setItem(KEY, JSON.stringify(data))

// backward compat: old format was string[], new is { zone: 'green'|'yellow'|'red' }
export const toZoneMap = v => {
	if (!v) return {}
	if (Array.isArray(v)) return Object.fromEntries(v.map(z => [z, 'red']))
	return v
}

export const getZonesByDate  = date => toZoneMap(read()[date])

export const setZonesByDate = (date, zones) => {
	const all = read()
	if (Object.keys(zones).length === 0) delete all[date]
	else all[date] = zones
	write(all)
}
