import { Route, Routes } from 'react-router-dom'

import IndexPage from './pages/IndexPage/IndexPage'
import ScrollToTop from './widgets/ScrollToTop'
import ProtectedRoute from './widgets/ProtectedRoute'
import MainPage from './pages/MainPage/MainPage'

const App = () => {
	return (
		<>
		<ScrollToTop/>
		<Routes>
			<Route
				path="/"
				element={<IndexPage />}
			/>
			<Route 
				path="/profile" 
				element={
					<ProtectedRoute>
						<MainPage />
					</ProtectedRoute>
				} 
			/>
			<Route
				path="*"
				element={<div>404 Not found </div>}
			/>
		</Routes>
		</>
	)
}
export default App
