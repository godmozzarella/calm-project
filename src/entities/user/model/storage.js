const USERS_KEY = 'users'
const CURRENT_USER_KEY = 'currentUser'

const readJson = key => {
	try {
		return JSON.parse(localStorage.getItem(key))
	} catch {
		return null
	}
}

export const getUsers = () => readJson(USERS_KEY) ?? []

export const saveUsers = users => {
	localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export const addUser = user => {
	const users = getUsers()
	const updated = [...users, user]
	saveUsers(updated)
	return updated
}

export const findUserByCredentials = (email, password) =>
	getUsers().find(u => u.email === email && u.password === password) ?? null

export const isEmailTaken = email =>
	getUsers().some(u => u.email === email)

export const getCurrentUser = () => readJson(CURRENT_USER_KEY)

export const setCurrentUser = user => {
	localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user))
}

export const clearCurrentUser = () => {
	localStorage.removeItem(CURRENT_USER_KEY)
}

export const updateCurrentUser = patch => {
	const current = getCurrentUser()
	if (!current) return null
	const next = { ...current, ...patch }
	setCurrentUser(next)
	saveUsers(getUsers().map(u => (u.id === next.id ? next : u)))
	return next
}
