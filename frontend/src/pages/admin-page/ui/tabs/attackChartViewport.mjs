const clamp = (value, min, max) => Math.max(min, Math.min(value, max))
const MONTHS_PER_VIEW = { day: 3, week: 6, month: 12 }
const DAY_MS = 86_400_000

export function maxVisibleDaySpan(lastDate, lastIndex, step) {
	const end = new Date(`${lastDate}T00:00:00Z`)
	const start = new Date(end)
	// Find the final day of the target month before restoring the day number.
	start.setUTCMonth(end.getUTCMonth() - MONTHS_PER_VIEW[step] + 1, 0)
	start.setUTCDate(Math.min(start.getUTCDate(), end.getUTCDate()))
	return Math.min(lastIndex, (end - start) / DAY_MS)
}

export function zoomViewport(view, lastIndex, factor, anchor = 0.5, target = anchor, maxSpan = lastIndex) {
	if (lastIndex <= 1) return null
	const visibleSpan = view?.span ?? lastIndex
	const span = clamp(visibleSpan / factor, 1, maxSpan)
	if (span === lastIndex) return null
	const position = (view?.start ?? 0) + anchor * visibleSpan
	return { start: clamp(position - target * span, 0, lastIndex - span), span }
}

export function readableViewport(view, lastIndex, maxSpan) {
	if (view) return view.span <= maxSpan ? view : zoomViewport(view, lastIndex, 1, 0.5, 0.5, maxSpan)
	return lastIndex > maxSpan ? { start: lastIndex - maxSpan, span: maxSpan } : null
}

export function panViewport(view, lastIndex, fraction) {
	if (!view) return null
	const start = clamp(view.start + fraction * view.span, 0, lastIndex - view.span)
	return start === view.start ? view : { start, span: view.span }
}

export function visibleDayBounds(view, lastIndex) {
	if (!view) return [0, lastIndex]
	const first = Math.min(Math.round(view.start), lastIndex - 1)
	return [first, clamp(Math.round(view.start + view.span), first + 1, lastIndex)]
}
