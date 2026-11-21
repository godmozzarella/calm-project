// backward compat: old format was string[], new is { zone: 'green'|'yellow'|'red' }
export const toZoneMap = v => {
	if (!v) return {}
	if (Array.isArray(v)) return Object.fromEntries(v.map(z => [z, 'red']))
	return v
}
