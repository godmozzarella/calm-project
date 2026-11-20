import { Route, Routes } from 'react-router-dom'

import { IndexPage } from '@/pages/index-page'
import { MainPage } from '@/pages/main-page'
import { StatsPage } from '@/pages/stats-page'
import { AdminPage } from '@/pages/admin-page'
import ProtectedRoute from '@/app/providers/router/ProtectedRoute'
import AdminRoute from '@/app/providers/router/AdminRoute'
import SessionEntry from '@/app/providers/router/SessionEntry'
import { isStandaloneApp } from '@/shared/lib/appInstallation'
import { readPendingEmailLogin } from '@/shared/lib/pendingEmailLogin'
import EmailLoginPage from '@/features/auth/ui/EmailLoginPage'
import PrivacyPolicyPage from '@/pages/privacy-policy-page/PrivacyPolicyPage'
import CancelEmailChangePage from '@/pages/cancel-email-change-page/CancelEmailChangePage'

const AppRouter = () => {
	const home = isStandaloneApp() && !readPendingEmailLogin()
		? <SessionEntry openDiary><IndexPage /></SessionEntry>
		: <IndexPage />
	return (
		<Routes>
			<Route path="/" element={home} />
			<Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
			<Route path="/email-login" element={<EmailLoginPage />} />
			<Route path="/cancel-email-change" element={<CancelEmailChangePage />} />
			<Route
				path="/profile"
				element={
					<SessionEntry key="profile">
						<ProtectedRoute><MainPage /></ProtectedRoute>
					</SessionEntry>
				}
			/>
			<Route
				path="/stats"
				element={
					<SessionEntry key="stats">
						<ProtectedRoute><StatsPage /></ProtectedRoute>
					</SessionEntry>
				}
			/>
			<Route
				path="/admin"
				element={
					<SessionEntry key="admin">
						<AdminRoute><AdminPage /></AdminRoute>
					</SessionEntry>
				}
			/>
			<Route path="*" element={<div>404 Not found</div>} />
		</Routes>
	)
}

export default AppRouter
