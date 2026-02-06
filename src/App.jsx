import { Route, Routes } from 'react-router-dom'

import IndexPage from './pages/IndexPage/IndexPage'
import MainPage from './pages/MainPage/MainPage'
import ScrollToTop from './components/ScrollToTop'

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
				path="/main"
				element={<MainPage />}
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
