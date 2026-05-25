import { Navigate } from 'react-router-dom'

import { getCurrentUser } from '@/entities/user'

const AdminRoute = ({ children }) => {
	const user = getCurrentUser()

	if (!user) return <Navigate to="/" replace />
	if (user.role !== 'ADMIN') return <Navigate to="/profile" replace />

	return children
}

export default AdminRoute
