const sameIntakeDetails = (a, b) =>
	a.date === b.date &&
	a.time?.slice(0, 5) === b.time?.slice(0, 5) &&
	(a.attackId ?? null) === (b.attackId ?? null) &&
	(a.note ?? '') === (b.note ?? '')

// До появления intakeId препараты одного добавления создавались параллельно.
// Берём только записи с теми же данными приёма и близким временем создания.
export const intakeMembers = (medication, medications) => {
	if (medication.intakeId) {
		return medications.filter(m => m.intakeId === medication.intakeId)
	}
	const createdAt = Date.parse(medication.createdAt)
	return medications.filter(m => {
		if (m.intakeId || !sameIntakeDetails(medication, m)) return false
		if (m.id === medication.id) return true
		const otherCreatedAt = Date.parse(m.createdAt)
		return Number.isFinite(createdAt) && Number.isFinite(otherCreatedAt) &&
			Math.abs(createdAt - otherCreatedAt) <= 10_000
	})
}

export const planIntakeUpdate = (existing, selected) => {
	const unused = new Map(existing.map(m => [m.id, m]))
	const reserved = new Set(selected.map(item => item.sourceId).filter(id => unused.has(id)))
	const updates = []
	const creates = []

	for (const item of selected) {
		let original = item.sourceId ? unused.get(item.sourceId) : null
		if (original) reserved.delete(original.id)
		if (!original) {
			original = [...unused.values()].find(m =>
				!reserved.has(m.id) &&
				m.name.toLocaleLowerCase() === item.name.toLocaleLowerCase() &&
				(!m.category || !item.category || m.category === item.category)
			)
		}
		if (!original) original = [...unused.values()].find(m => !reserved.has(m.id))
		if (original) {
			unused.delete(original.id)
			updates.push({ original, item })
		} else {
			creates.push(item)
		}
	}

	return { updates, creates, removes: [...unused.values()] }
}
