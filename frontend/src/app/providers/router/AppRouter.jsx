import { Route, Routes } from 'react-router-dom'

import { IndexPage } from '@/pages/index-page'
import { MainPage } from '@/pages/main-page'
import { StatsPage } from '@/pages/stats-page'
import ProtectedRoute from '@/app/providers/router/ProtectedRoute'

const AppRouter = () => {
	return (
		<Routes>
			<Route path="/" element={<IndexPage />} />
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
			<Route path="*" element={<div>404 Not found</div>} />
		</Routes>
	)
}

export default AppRouter
