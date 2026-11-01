import { useCallback, useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { SidebarProfile } from '@/widgets/sidebar-profile'
import { SidebarCalendar } from '@/widgets/sidebar-calendar'
import { MainSection } from '@/widgets/main-section'
import { midnight } from '@/widgets/day-bar'
import { Button } from '@/shared/ui/Button'
import { CalendarMonthIcon, MenuIcon } from '@/shared/ui/icons'
import { getCurrentUser, setCurrentUser } from '@/entities/user'
import { userApi, getToken, riskApi } from '@/shared/api'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import PageLoading from '@/shared/ui/PageLoading/PageLoading'
import { LocationOnboarding } from '@/features/onboarding-location'
import AutoLocationCheck from '@/features/onboarding-location/ui/AutoLocationCheck'
import ConsentPrompt from '@/features/shared-model-consent/ui/ConsentPrompt'

import s from './MainPage.module.scss'

const MainPage = () => {
	const location = useLocation()
	const navigate = useNavigate()
	const [openMenu, setOpenMenu] = useState(() => location.state?.openMenu === true)
	const [openCalendar, setOpenCalendar] = useState(false)
	const [diaryDate, setDiaryDate] = useState(midnight)
	// Ленивая инициализация: сразу читаем из localStorage, чтобы не было мигания
	// «не авторизован» между первым рендером и useEffect.
	const [user, setUser] = useState(() => getCurrentUser())
	const [sessionVerified, setSessionVerified] = useState(false)
	const [showLocationOnboarding, setShowLocationOnboarding] = useState(false)
	const [onboardingDismissed, setOnboardingDismissed] = useState(false)
	const [consentPrompt, setConsentPrompt] = useState(null)
	const [consentSaving, setConsentSaving] = useState(false)
	const [consentError, setConsentError] = useState('')
	const [readyParts, setReadyParts] = useState({})
	const [showBeforeReady, setShowBeforeReady] = useState(false)
	const markReady = useCallback(part => setReadyParts(previous =>
		previous[part] ? previous : { ...previous, [part]: true }), [])
	const diaryReady = ['attacks', 'medications', 'zones', 'forecast', 'chart', 'outcome']
		.every(part => readyParts[part])
	const diaryVisible = diaryReady || showBeforeReady
	useBodyScrollLock(openMenu || openCalendar || !diaryVisible)

	// On mobile browsers the route can inherit the guest page's scroll while the diary
	// is loading under an overflow lock. Reset again after the lock is released.
	useEffect(() => {
		if (!diaryVisible || location.state?.scrollToChart) return undefined
		const root = document.documentElement
		const body = document.body
		const resetScroll = () => {
			window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
			root.scrollTop = 0
			body.scrollTop = 0
		}
		let settleFrame = 0
		const resetFrame = window.requestAnimationFrame(() => {
			resetScroll()
			settleFrame = window.requestAnimationFrame(resetScroll)
		})
		return () => {
			window.cancelAnimationFrame(resetFrame)
			window.cancelAnimationFrame(settleFrame)
		}
	}, [diaryVisible, location.state?.scrollToChart])

	useEffect(() => {
		if (location.state?.openMenu !== true) return
		navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null })
	}, [location.hash, location.pathname, location.search, location.state, navigate])

	useEffect(() => {
		if (!location.state?.scrollToChart || !diaryVisible) return undefined
		const frame = window.requestAnimationFrame(() => {
			document.getElementById('diary-chart')?.scrollIntoView({ block: 'start', behavior: 'auto' })
		})
		return () => window.cancelAnimationFrame(frame)
	}, [location.state, diaryVisible])

	const hasToken = !!getToken()

	useEffect(() => {
		if (!hasToken) {
			setSessionVerified(false)
			return undefined
		}
		let active = true
		userApi.getMe().then(fresh => {
			if (!active) return
			setUser(fresh)
			setCurrentUser(fresh)
			setSessionVerified(true)
		}).catch(() => {
			if (active) setSessionVerified(false)
		})
		return () => { active = false }
	}, [hasToken])

	useEffect(() => {
		if (!sessionVerified || !user) return
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
	}, [sessionVerified, user])

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
            {sessionVerified && <AutoLocationCheck user={user} setUser={setUser} />}
			{!diaryVisible && <PageLoading label="Загружаем дневник…" onContinue={() => setShowBeforeReady(true)} />}
			<Button
				className={`${s.icon} ${s.menu}`}
				icon={<MenuIcon />}
				aria-label="Открыть меню"
				data-help="Открыть меню профиля, настроек и статистики."
				onClick={() => setOpenMenu(prev => !prev)}
			/>

			<Button
				className={`${s.icon} ${s.calendar}`}
				icon={<CalendarMonthIcon />}
				aria-label="Открыть календарь"
				data-help="Открыть календарь и выбрать день дневника."
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
				currentDate={diaryDate}
			/>

			<MainSection
				user={user}
				date={diaryDate}
				setDate={setDiaryDate}
				onInitialReady={markReady}
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
