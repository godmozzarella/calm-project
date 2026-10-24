export const streakSnapshotKey = userId => `calm_streak_${userId}`

export const streakIncrease = (previous, current) => {
	if (!previous || !Number.isInteger(previous.count) || !Number.isInteger(current)) return 0
	return current > previous.count ? current - previous.count : 0
}
