export function locationDistanceKm(a, b) {
    if ([a.latitude, a.longitude, b.latitude, b.longitude].some(value => value == null)) return Infinity
    const radians = value => value * Math.PI / 180
    const lat = radians(b.latitude - a.latitude)
    const lon = radians(b.longitude - a.longitude)
    const h = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lon / 2) ** 2
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}
export function shouldSuggestLocation(current, candidate) {
    if (current.locationMode !== 'AUTO') return false
    const city = value => (value || '').split(',')[0].trim().toLocaleLowerCase()
    return city(current.city) !== city(candidate.city) || locationDistanceKm(current, candidate) >= 20
}
