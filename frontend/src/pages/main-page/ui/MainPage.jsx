import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { SidebarProfile } from '@/widgets/sidebar-profile'
import { SidebarCalendar } from '@/widgets/sidebar-calendar'
import { MainSection } from '@/widgets/main-section'
import { midnight } from '@/widgets/day-bar'
import { Button } from '@/shared/ui/Button'
import { CalendarMonthIcon, MenuIcon } from '@/shared/ui/icons'
import { getCurrentUser, setCurrentUser } from '@/entities/user'
import { userApi, getToken, riskApi } from '@/shared/api'
import { notifyRequestError } from '@/shared/lib/notifyError'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import { resetViewportScroll } from '@/shared/lib/resetViewportScroll'
import PageLoading from '@/shared/ui/PageLoading/PageLoading'
import { LocationOnboarding } from '@/features/onboarding-location'
import AutoLocationCheck from '@/features/onboarding-location/ui/AutoLocationCheck'
import DiaryProfileOnboarding from '@/features/onboarding-location/ui/DiaryProfileOnboarding'
import welcomeStyles from '@/features/onboarding-location/ui/DiaryProfileOnboarding.module.scss'
import { questionnaireApi } from '@/shared/api/questionnaireApi'
import ConsentPrompt from '@/features/shared-model-consent/ui/ConsentPrompt'
import DiaryTour from './DiaryTour'

import s from './MainPage.module.scss'

const MainPage = () => {
	const location = useLocation()
	const navigate = useNavigate()
	const reminder = new URLSearchParams(location.search).get('reminder')
	const [openMenu, setOpenMenu] = useState(() => location.state?.openMenu === true)
	const [openCalendar, setOpenCalendar] = useState(false)
	const [diaryDate, setDiaryDate] = useState(midnight)
	// Ленивая инициализация: сразу читаем из localStorage, чтобы не было мигания
	// «не авторизован» между первым рендером и useEffect.
	const [user, setUser] = useState(() => getCurrentUser())
	const [sessionVerified, setSessionVerified] = useState(false)
	const [showLocationOnboarding, setShowLocationOnboarding] = useState(false)
	const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
		const id = getCurrentUser()?.id
		try { return Boolean(id && localStorage.getItem(`calm:location-later:${id}`) === '1') }
		catch { return false }
	})
	const [profileOnboarding, setProfileOnboarding] = useState('loading')
	const [profileCheck, setProfileCheck] = useState(0)
	const [consentPrompt, setConsentPrompt] = useState(null)
	const [consentCheckedFor, setConsentCheckedFor] = useState(null)
	const [consentSaving, setConsentSaving] = useState(false)
	const [tourPendingFor, setTourPendingFor] = useState(null)
	const [tourRequested, setTourRequested] = useState(false)
	const [readyParts, setReadyParts] = useState({})
	const [showBeforeReady, setShowBeforeReady] = useState(false)
	const markReady = useCallback(part => setReadyParts(previous =>
		previous[part] ? previous : { ...previous, [part]: true }), [])
	const diaryReady = ['attacks', 'medications', 'zones', 'forecast', 'chart', 'outcome']
		.every(part => readyParts[part])
	const diaryVisible = diaryReady || showBeforeReady
	const tourOpen = sessionVerified && diaryVisible && profileOnboarding === 'done' &&
		!showLocationOnboarding && !openMenu && !openCalendar && !consentPrompt && !consentSaving &&
		(tourRequested || (tourPendingFor === user?.id && consentCheckedFor === user?.id))
	useBodyScrollLock(!diaryVisible)
	useBodyScrollLock(openMenu || openCalendar, { freezePosition: true })

	// Reset after the diary can render, including when Safari restores the page from its cache.
	useLayoutEffect(() => {
		if (!diaryVisible || location.state?.scrollToChart || location.state?.reminderHandled || reminder === 'attack' || reminder === 'cards') return undefined
		let resetFrame = 0
		let settleFrame = 0
		const cancelReset = () => {
			window.cancelAnimationFrame(resetFrame)
			window.cancelAnimationFrame(settleFrame)
		}
		const reset = () => {
			cancelReset()
			resetViewportScroll()
			resetFrame = window.requestAnimationFrame(() => {
				resetViewportScroll()
				settleFrame = window.requestAnimationFrame(resetViewportScroll)
			})
		}
		const onPageShow = event => { if (event.persisted) reset() }
		reset()
		window.addEventListener('pageshow', onPageShow)
		return () => {
			cancelReset()
			window.removeEventListener('pageshow', onPageShow)
		}
	}, [diaryVisible, location.state?.scrollToChart, location.state?.reminderHandled, reminder])

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
				if (!active) return
				setConsentCheckedFor(user.id)
				setConsentPrompt(current => {
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
			notifyRequestError(error, 'Не удалось сохранить решение')
		} finally {
			setConsentSaving(false)
		}
	}

	useEffect(() => {
		if (!sessionVerified || !diaryVisible || profileOnboarding !== 'done' || showLocationOnboarding || consentPrompt || tourOpen) return
		if (reminder !== 'cards' && reminder !== 'attack') return
		if (reminder === 'attack') {
			setDiaryDate(midnight())
			document.getElementById('diary-attacks')?.scrollIntoView({ block: 'start' })
		} else {
			document.querySelector('[data-streak-target]')?.scrollIntoView({ block: 'center' })
		}
		const search = new URLSearchParams(location.search)
		search.delete('reminder')
		navigate({ pathname: location.pathname, search: search.toString(), hash: location.hash }, {
			replace: true,
			state: { ...location.state, reminderHandled: true },
		})
	}, [reminder, sessionVerified, diaryVisible, profileOnboarding, showLocationOnboarding, consentPrompt, tourOpen, location, navigate])

	useEffect(() => {
		if (!sessionVerified || !user?.id) return undefined
		let active = true
		questionnaireApi.getProfile().then(profile => {
			if (!active) return
			setProfileOnboarding(profile ? 'done' : 'open')
			try {
				if (profile && localStorage.getItem(`calm:diary-tour-pending:${user.id}`) === '1') setTourPendingFor(user.id)
			} catch { /* The tour can still be started from the menu. */ }
		}).catch(error => {
			if (!active) return
			setProfileOnboarding('error')
			notifyRequestError(error, 'Не удалось загрузить настройку дневника')
		})
		return () => { active = false }
	}, [sessionVerified, user?.id, profileCheck])

	useEffect(() => {
		if (!user || onboardingDismissed) return
		if (profileOnboarding !== 'done') return
		if (user.latitude == null || user.longitude == null) {
			setShowLocationOnboarding(true)
		}
	}, [user, onboardingDismissed, profileOnboarding])

	const completeOnboarding = () => {
		if (user.latitude == null || user.longitude == null) {
			try { localStorage.setItem(`calm:location-later:${user.id}`, '1') } catch { /* Continue with this session. */ }
		}
		setOnboardingDismissed(true)
		setShowLocationOnboarding(false)
		setProfileOnboarding('done')
	}

	const queueTour = () => {
		setTourPendingFor(user.id)
		try { localStorage.setItem(`calm:diary-tour-pending:${user.id}`, '1') } catch { /* Continue in this session. */ }
	}

	const closeTour = () => {
		setTourRequested(false)
		setTourPendingFor(null)
		try { localStorage.removeItem(`calm:diary-tour-pending:${user.id}`) } catch { /* Continue in this session. */ }
	}

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
				title="Открыть меню профиля, настроек и статистики."
				onClick={() => setOpenMenu(prev => !prev)}
			/>

			<Button
				className={`${s.icon} ${s.calendar}`}
				icon={<CalendarMonthIcon />}
				data-tour="calendar"
				aria-label="Открыть календарь"
				title="Открыть календарь и выбрать день дневника."
				onClick={() => setOpenCalendar(prev => !prev)}
			/>

			<SidebarProfile
				openMenu={openMenu}
				setOpenMenu={setOpenMenu}
				user={user}
				setUser={setUser}
				onStartTour={() => { setOpenMenu(false); setTourRequested(true) }}
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

			{profileOnboarding === 'open' && <DiaryProfileOnboarding user={user} setUser={setUser} onProfileSaved={queueTour} onComplete={completeOnboarding} />}
			{profileOnboarding === 'error' && <div className={welcomeStyles.backdrop}>
				<section className={welcomeStyles.panel} aria-labelledby="welcome-retry-title">
					<div className={welcomeStyles.nextStep}>
						<h2 id="welcome-retry-title">Настройка дневника</h2>
						<button title={"Повторить"} type="button" className={welcomeStyles.primary} onClick={() => { setProfileOnboarding('loading'); setProfileCheck(value => value + 1) }}>Повторить</button>
					</div>
				</section>
			</div>}
			<LocationOnboarding
				open={showLocationOnboarding && profileOnboarding === 'done'}
				onClose={() => {
					setShowLocationOnboarding(false)
					setOnboardingDismissed(true)
				}}
				setUser={setUser}
			/>
			<ConsentPrompt
				status={profileOnboarding === 'done' && !showLocationOnboarding ? consentPrompt : null}
				saving={consentSaving}
				onDecide={decideParticipation}
			/>
			{tourOpen && <DiaryTour onClose={closeTour} />}
		</div>
	)
}

export default MainPage
