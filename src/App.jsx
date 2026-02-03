import { Route, Routes } from 'react-router-dom'

import IndexPage from './pages/IndexPage/IndexPage'
import MainPage from './pages/MainPage/MainPage'

const App = () => {
	return (
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
	)
}
export default App
