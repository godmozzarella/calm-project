export function dateTicks(points, step) {
	if (step === 'day' || points.length < 2) return points
	const ticks = points.filter(({ date }) => step === 'month'
		? date.endsWith('-01')
		: new Date(`${date}T00:00:00Z`).getUTCDay() === 1)
	if (ticks.length) return ticks
	return step === 'month' ? [points[Math.floor(points.length / 2)]] : [points[0], points.at(-1)]
}

export function spacedDateLabels(ticks, minimumGap) {
	let lastX = -Infinity
	return ticks.filter(({ x }) => {
		if (x - lastX < minimumGap) return false
		lastX = x
		return true
	})
}

export function countAxis(peak, step, scale, height) {
	const maximum = Math.ceil(Math.max(4, peak) / step) * step
	const logarithmic = scale === 'log'
	const limit = logarithmic ? Math.log1p(maximum) : maximum
	const fraction = count => (logarithmic ? Math.log1p(count) : count) / limit
	const countAt = position => logarithmic ? Math.expm1(position * limit) : position * limit
	const ticks = minimumGap => {
		const gap = minimumGap / height
		const marks = [0]
		let count = 0
		while (count < maximum) {
			const target = countAt(fraction(count) + gap)
			count = Math.max(count + step, Math.ceil(target / step - 1e-8) * step)
			if (1 - fraction(count) < gap - 1e-8) break
			marks.push(count)
		}
		return [...marks, maximum]
	}
	return { fraction, ticks }
}
