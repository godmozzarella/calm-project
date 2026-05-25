import ScrollToTop from '@/app/providers/router/ScrollToTop'
import AppRouter from '@/app/providers/router/AppRouter'
import { DictionariesProvider } from '@/shared/lib/dictionaries'

const App = () => {
	return (
		<DictionariesProvider>
			<ScrollToTop />
			<AppRouter />
		</DictionariesProvider>
	)
}

export default App
