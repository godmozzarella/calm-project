import { Route, Routes } from 'react-router-dom'

import { IndexPage } from '@/pages/index-page'
import { MainPage } from '@/pages/main-page'
import { StatsPage } from '@/pages/stats-page'
import { AdminPage } from '@/pages/admin-page'
import ProtectedRoute from '@/app/providers/router/ProtectedRoute'
import AdminRoute from '@/app/providers/router/AdminRoute'
import VerifyEmailPage from '@/pages/verify-email-page/VerifyEmailPage'

const AppRouter = () => {
	return (
		<Routes>
			<Route path="/" element={<IndexPage />} />
			<Route path="/verify-email" element={<VerifyEmailPage />} />
			<Route
				path="/profile"
				element={
					<ProtectedRoute>
						<MainPage />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/stats"
				element={
					<ProtectedRoute>
						<StatsPage />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/admin"
				element={
					<AdminRoute>
						<AdminPage />
					</AdminRoute>
				}
			/>
			<Route path="*" element={<div>404 Not found</div>} />
		</Routes>
	)
}

export default AppRouter
