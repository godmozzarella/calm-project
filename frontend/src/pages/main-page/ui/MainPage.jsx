import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { SidebarProfile } from '@/widgets/sidebar-profile'
import { SidebarCalendar } from '@/widgets/sidebar-calendar'
import { MainSection } from '@/widgets/main-section'
import { Button } from '@/shared/ui/Button'
import { CalendarMonthIcon, MenuIcon } from '@/shared/ui/icons'
import { getCurrentUser, setCurrentUser } from '@/entities/user'
import { userApi, getToken, riskApi } from '@/shared/api'
import { LocationOnboarding } from '@/features/onboarding-location'
import ConsentPrompt from '@/features/shared-model-consent/ui/ConsentPrompt'

import s from './MainPage.module.scss'

const MainPage = () => {
	const [openMenu, setOpenMenu] = useState(false)
	const [openCalendar, setOpenCalendar] = useState(false)
	// Ленивая инициализация: сразу читаем из localStorage, чтобы не было мигания
	// «не авторизован» между первым рендером и useEffect.
	const [user, setUser] = useState(() => getCurrentUser())
	const [showLocationOnboarding, setShowLocationOnboarding] = useState(false)
	const [onboardingDismissed, setOnboardingDismissed] = useState(false)
	const [consentPrompt, setConsentPrompt] = useState(null)
	const [consentSaving, setConsentSaving] = useState(false)
	const [consentError, setConsentError] = useState('')

	const hasToken = !!getToken()

	useEffect(() => {
		if (!hasToken) return
		userApi.getMe().then(fresh => {
			setUser(fresh)
			setCurrentUser(fresh)
		}).catch(() => {})
	}, [hasToken])

	useEffect(() => {
		if (!hasToken || !user) return
		let active = true
		const refreshPrompt = () => {
			riskApi.getParticipation().then(status => {
				if (active) setConsentPrompt(current => {
					if (!status.showConsentPrompt) return null
					if (current?.currentConsentVersion === status.currentConsentVersion &&
						current?.currentConsentDigest === status.currentConsentDigest) return current
					return status
				})
			}).catch(() => {})
		}
		const onFocus = () => {
			if (document.visibilityState === 'visible') refreshPrompt()
		}
		refreshPrompt()
		const interval = window.setInterval(refreshPrompt, 60_000)
		window.addEventListener('focus', onFocus)
		return () => {
			active = false
			window.clearInterval(interval)
			window.removeEventListener('focus', onFocus)
		}
	}, [hasToken, user])

	const decideParticipation = async participate => {
		if (!consentPrompt || consentSaving) return
		setConsentSaving(true)
		setConsentError('')
		try {
			if (participate) {
				await riskApi.joinSharedModelPilot(consentPrompt.currentConsentVersion, consentPrompt.currentConsentDigest)
			} else {
				await riskApi.declineSharedModelPilot(consentPrompt.currentConsentVersion, consentPrompt.currentConsentDigest)
			}
			setConsentPrompt(null)
		} catch (error) {
			try {
				const latest = await riskApi.getParticipation()
				setConsentPrompt(latest.showConsentPrompt ? latest : null)
				if (!latest.showConsentPrompt) return
			} catch { /* Keep the original save error visible. */ }
			setConsentError(error.message || 'Не удалось сохранить решение. Попробуйте ещё раз.')
		} finally {
			setConsentSaving(false)
		}
	}

	useEffect(() => {
		if (!user || onboardingDismissed) return
		if (user.latitude == null || user.longitude == null) {
			setShowLocationOnboarding(true)
		}
	}, [user, onboardingDismissed])

	if (!hasToken) {
		return <Navigate to="/" replace />
	}

	if (!user) {
		return null
	}

	return (
		<div className={s.mainPage}>
			<Button
				className={`${s.icon} ${s.menu}`}
				icon={<MenuIcon />}
				onClick={() => setOpenMenu(prev => !prev)}
			/>

			<Button
				className={`${s.icon} ${s.calendar}`}
				icon={<CalendarMonthIcon />}
				onClick={() => setOpenCalendar(prev => !prev)}
			/>

			<SidebarProfile
				openMenu={openMenu}
				setOpenMenu={setOpenMenu}
				user={user}
				setUser={setUser}
			/>

			<SidebarCalendar
				openCalendar={openCalendar}
				setOpenCalendar={setOpenCalendar}
			/>

			<MainSection
				user={user}
				onOpenLocationModal={() => {
					setOnboardingDismissed(false)
					setShowLocationOnboarding(true)
				}}
			/>

			<LocationOnboarding
				open={showLocationOnboarding}
				onClose={() => {
					setShowLocationOnboarding(false)
					setOnboardingDismissed(true)
				}}
				setUser={setUser}
			/>
			<ConsentPrompt
				status={consentPrompt}
				saving={consentSaving}
				error={consentError}
				onDecide={decideParticipation}
			/>
		</div>
	)
}

export default MainPage
