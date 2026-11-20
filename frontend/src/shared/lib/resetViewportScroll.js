export function resetViewportScroll() {
	const { documentElement: root, body } = document
	const previous = root.style.getPropertyValue('scroll-behavior')
	const priority = root.style.getPropertyPriority('scroll-behavior')
	root.style.setProperty('scroll-behavior', 'auto', 'important')
	try {
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
		root.scrollTop = 0
		body.scrollTop = 0
	} finally {
		if (previous) root.style.setProperty('scroll-behavior', previous, priority)
		else root.style.removeProperty('scroll-behavior')
	}
}
