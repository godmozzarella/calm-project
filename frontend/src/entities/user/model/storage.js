const KEY = 'calm_current_user'

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) }
  catch { return null }
}

export const getCurrentUser  = ()     => read()
export const setCurrentUser  = user   => localStorage.setItem(KEY, JSON.stringify(user))
export const clearCurrentUser = ()    => localStorage.removeItem(KEY)

export const updateCurrentUser = patch => {
  const current = read()
  if (!current) return null
  const next = { ...current, ...patch }
  setCurrentUser(next)
  return next
}
