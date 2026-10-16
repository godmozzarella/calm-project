export const sortAttacksNewest = attacks => [...attacks].sort((a, b) => {
	if (a.ongoing !== b.ongoing) return a.ongoing ? -1 : 1
	const startA = `${a.startDate ?? a.date ?? ''}T${a.startTime ?? ''}`
	const startB = `${b.startDate ?? b.date ?? ''}T${b.startTime ?? ''}`
	return startB.localeCompare(startA) || String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
})
