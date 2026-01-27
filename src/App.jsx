import { Route, Routes } from 'react-router-dom'

import IndexPage from './pages/IndexPage/IndexPage'

const App = () => {
	return (
		<Routes>
					<Route
						path="/"
						element={<IndexPage />}
					/>
					<Route
						path="/main"
						element={<IndexPage />}
					/>
					<Route
						path="*"
						element={<div>404 Not found </div>}
					/>
				</Routes>
	)
}
export default App
