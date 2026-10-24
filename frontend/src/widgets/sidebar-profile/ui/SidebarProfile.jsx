import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createPortal } from 'react-dom'

import { Input } from '@/shared/ui/Input'
import { notifyError } from '@/shared/lib/notifyError'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'
import { Button } from '@/shared/ui/Button'
import {
	CloseIcon,
	ChevronRightIcon,
	BackIcon,
	PersonIcon,
	AnalyticsIcon,
	SecurityIcon,
	LogoutIcon,
	PhotoCameraIcon,
	DeleteIcon,
	NotificationsNoneIcon,
	DarkModeOutlinedIcon,
	LightModeOutlinedIcon,
	LanguageIcon,
	VisibilityIcon,
	VisibilityOffIcon,
	TelegramIcon,
	XIcon,
	YouTubeIcon,
	InstagramIcon,
	EditLocationIcon,
} from '@/shared/ui/icons'
import { useEditProfile } from '@/features/edit-profile'
import { LocationOnboarding } from '@/features/onboarding-location'
import { clearCurrentUser, setCurrentUser } from '@/entities/user'
import { authApi, userApi, forecastApi, riskApi } from '@/shared/api'
import { useTheme } from '@/app/providers/theme/useTheme'

import s from './SidebarProfile.module.scss'

const SidebarProfile = ({ openMenu, setOpenMenu, user, setUser }) => {
	const { theme, toggleTheme } = useTheme()
	const navigate = useNavigate()
	const [view, setView] = useState('main')
	const [showPassword, setShowPassword] = useState(false)
	const [showNewPassword, setShowNewPassword] = useState(false)
	const [locationModalOpen, setLocationModalOpen] = useState(false)
	const [togglingNotif, setTogglingNotif] = useState(false)
	const [sendingTest, setSendingTest] = useState(false)
	const [testMessage, setTestMessage] = useState(null)
	const [verificationOpen, setVerificationOpen] = useState(false)
	const [verificationCode, setVerificationCode] = useState('')
	const [verificationSending, setVerificationSending] = useState(false)
	const [verificationChecking, setVerificationChecking] = useState(false)
	const [verificationSent, setVerificationSent] = useState(false)
	const [verificationCooldown, setVerificationCooldown] = useState(0)
	const [verificationError, setVerificationError] = useState('')
	const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
	const [loggingOut, setLoggingOut] = useState(false)
	const [participation, setParticipation] = useState(null)
	const [loadingParticipation, setLoadingParticipation] = useState(false)
	const [savingParticipation, setSavingParticipation] = useState(false)
	const [participationError, setParticipationError] = useState('')

	const openParticipation = async () => {
		setView('participation')
		setLoadingParticipation(true)
		setParticipationError('')
		try {
			setParticipation(await riskApi.getParticipation())
		} catch (e) {
			setParticipationError(e.message || 'Не удалось загрузить статус участия.')
		} finally {
			setLoadingParticipation(false)
		}
	}

	const changeParticipation = async join => {
		if (savingParticipation) return
		setSavingParticipation(true)
		setParticipationError('')
		try {
			const result = join
				? await riskApi.joinSharedModelPilot(participation.currentConsentVersion, participation.currentConsentDigest)
				: await riskApi.withdrawSharedModelPilot()
			setParticipation(result)
		} catch (e) {
			setParticipationError(e.message || 'Не удалось сохранить решение.')
			if (join) {
				try { setParticipation(await riskApi.getParticipation()) } catch { /* Preserve the save error. */ }
			}
		} finally {
			setSavingParticipation(false)
		}
	}

	const toggleNotifications = async () => {
		if (togglingNotif) return
		if (!user.emailVerified) {
			setVerificationCode('')
			setVerificationError('')
			setVerificationSent(false)
			setVerificationOpen(true)
			return
		}
		setTogglingNotif(true)
		try {
			const updated = await userApi.updateMe({ notificationsEnabled: !user.notificationsEnabled })
			setCurrentUser(updated)
			setUser(updated)
		} catch {
			// ошибка — оставляем как было
		} finally {
			setTogglingNotif(false)
		}
	}

	const sendTestEmail = async () => {
		if (sendingTest) return
		setSendingTest(true)
		setTestMessage(null)
		try {
			const res = await forecastApi.sendTestNotification()
			setTestMessage(res?.message || 'Письмо отправлено')
		} catch (e) {
			setTestMessage(e.message || 'Ошибка отправки')
		} finally {
			setSendingTest(false)
			setTimeout(() => setTestMessage(null), 8000)
		}
	}

	const sendVerificationCode = async () => {
		if (verificationSending || verificationCooldown > 0) return
		setVerificationSending(true)
		setVerificationError('')
		try {
			await authApi.sendVerificationCode()
			setVerificationSent(true)
			setVerificationCooldown(30)
			setVerificationCode('')
		} catch (e) {
			setVerificationError(e.message || 'Не удалось отправить код.')
			const retry = e.message?.match(/через\s+(\d+)\s+сек/i)
			if (retry) setVerificationCooldown(Number(retry[1]))
		} finally {
			setVerificationSending(false)
		}
	}

	const verifyEmailCode = async event => {
		event.preventDefault()
		if (verificationChecking || verificationCode.length !== 4) return
		setVerificationChecking(true)
		setVerificationError('')
		try {
			await authApi.verifyEmail(verificationCode)
			const verifiedUser = await userApi.getMe()
			setCurrentUser(verifiedUser)
			setUser(verifiedUser)
			const updated = await userApi.updateMe({ notificationsEnabled: true })
			setCurrentUser(updated)
			setUser(updated)
			setVerificationOpen(false)
			setVerificationSent(false)
			setVerificationCode('')
			setTestMessage('Email подтверждён, уведомления включены.')
		} catch (e) {
			setVerificationError(e.message || 'Не удалось подтвердить код.')
		} finally {
			setVerificationChecking(false)
		}
	}

	useEffect(() => {
		if (verificationCooldown <= 0) return undefined
		const timer = window.setTimeout(() => setVerificationCooldown(value => Math.max(0, value - 1)), 1000)
		return () => window.clearTimeout(timer)
	}, [verificationCooldown])

	useEffect(() => {
		if (!verificationOpen) return undefined
		const onKeyDown = event => {
			if (event.key === 'Escape' && !verificationSending && !verificationChecking) setVerificationOpen(false)
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [verificationOpen, verificationSending, verificationChecking])

	const {
		editData,
		tempAvatar,
		passwordError,
		openForm,
		closeForm,
		handleInputChange,
		handleAvatarUpload,
		handleAvatarDelete,
		handleSaveChanges,
	} = useEditProfile({ user, setUser })

	const initials = user?.name
		? user.name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
		: user?.email?.[0]?.toUpperCase() ?? '?'

	// Старые записи в БД хранят абсолютный URL http://localhost:8080/api/...
	// Нормализуем до относительного пути чтобы работало с любого устройства/IP.
	// Blob-URL (превью при загрузке) оставляем как есть.
	const resolveAvatar = url => {
		if (!url) return null
		if (url.startsWith('/') || url.startsWith('blob:')) return url
		try { return new URL(url).pathname } catch { return url }
	}

	const handleClose = () => {
		setOpenMenu(false)
		setTimeout(() => {
			setView('main')
			closeForm()
		}, 300)
	}

	const handleOpenEdit = () => {
		openForm()
		setView('edit')
	}

	const handleBackToMain = () => {
		closeForm()
		setView('main')
	}

	const handleLogout = async () => {
		if (loggingOut) return
		setLoggingOut(true)
		await authApi.logout()
		clearCurrentUser()
		navigate('/')
	}

	const handleDeleteAccount = async () => {
		const confirm1 = window.confirm(
			'Удалить аккаунт?\n\nВсе ваши приступы, препараты и зоны боли будут безвозвратно удалены.'
		)
		if (!confirm1) return
		const confirm2 = window.prompt('Чтобы подтвердить удаление, введите "УДАЛИТЬ":')
		if (confirm2?.trim().toUpperCase() !== 'УДАЛИТЬ') return

		try {
			await userApi.deleteAccount()
			// Бэк уже снёс пользователя; чистим локальную сессию.
			await authApi.logout().catch(() => {})
			clearCurrentUser()
			navigate('/')
		} catch (e) {
			notifyError(e.message || 'Ошибка сети', 'Не удалось удалить аккаунт')
		}
	}

	return (
		<>
			<aside className={`${s.sidebar} ${openMenu ? s.active : ''}`}>
				<div className={s.panels}>
					{/* ── Main panel ── */}
					<div className={`${s.panel} ${view === 'main' ? s.panelVisible : s.panelHiddenLeft}`}>
						<div className={s.panelHeader}>
							<span className={s.panelTitle}>Профиль</span>
							<button className={s.iconBtn} onClick={handleClose} aria-label="Закрыть">
								<CloseIcon fontSize="small" />
							</button>
						</div>

						<div className={s.userSection}>
							<div className={`${s.avatarWrapper} ${s.avatarReadOnly}`}>
								{user?.avatarUrl ? (
									<img className={s.avatar} src={resolveAvatar(user.avatarUrl)} alt="Аватар" />
								) : (
									<div className={s.avatarPlaceholder}>
										<span className={s.initials}>{initials}</span>
									</div>
								)}
							</div>
							<p className={s.userName}>{user?.name || 'Пользователь'}</p>
							<p className={s.userEmail}>{user?.email}</p>
						</div>

						<div className={s.divider} />

						<nav className={s.navSection}>
							<button className={s.navItem} onClick={handleOpenEdit}>
								<span className={s.navIcon}><PersonIcon fontSize="small" /></span>
								<span className={s.navLabel}>Редактировать профиль</span>
								<span className={s.navChevron}><ChevronRightIcon fontSize="small" /></span>
							</button>
							<Link to="/stats" className={s.navItem} onClick={handleClose}>
								<span className={s.navIcon}><AnalyticsIcon fontSize="small" /></span>
								<span className={s.navLabel}>Статистика</span>
								<span className={s.navChevron}><ChevronRightIcon fontSize="small" /></span>
							</Link>
							{user?.role === 'ADMIN' && (
								<Link to="/admin" className={s.navItem} onClick={handleClose}>
									<span className={s.navIcon}><SecurityIcon fontSize="small" /></span>
									<span className={s.navLabel}>Админка</span>
									<span className={s.navChevron}><ChevronRightIcon fontSize="small" /></span>
								</Link>
							)}
						</nav>

						<div className={s.divider} />

						<div className={s.sectionLabel}>Настройки</div>
						<nav className={s.navSection}>
							<button className={s.navItem} onClick={openParticipation}>
								<span className={s.navIcon}><AnalyticsIcon fontSize="small" /></span>
								<span className={s.navLabel}>Пилот общей модели</span>
								<span className={s.navChevron}><ChevronRightIcon fontSize="small" /></span>
							</button>
							<button
								className={s.navItem}
								onClick={() => setLocationModalOpen(true)}
								title={user?.city || 'Локация не задана'}
							>
								<span className={s.navIcon}><EditLocationIcon fontSize="small" /></span>
								<span className={s.navLabel}>Город для прогноза</span>
								<span className={s.navHint}>{user?.city || 'не задан'}</span>
								<span className={s.navChevron}><ChevronRightIcon fontSize="small" /></span>
							</button>
							<button
								className={s.navItem}
								onClick={toggleNotifications}
								disabled={togglingNotif}
								role="switch"
								aria-checked={Boolean(user?.emailVerified && user?.notificationsEnabled)}
							>
								<span className={s.navIcon}><NotificationsNoneIcon fontSize="small" /></span>
								<span className={s.navLabel}>Email-уведомления</span>
								<span className={`${s.toggleTrack} ${user?.emailVerified && user?.notificationsEnabled ? s.toggleChecked : ''}`} aria-hidden="true">
									<span className={s.toggleThumb} />
								</span>
							</button>
							<button
								className={s.navItem}
								onClick={sendTestEmail}
								disabled={sendingTest || !user?.emailVerified || !user?.notificationsEnabled || !user?.latitude}
								title={!user?.emailVerified
									? 'Сначала подтвердите email'
									: !user?.latitude
									? 'Сначала укажи город'
									: !user?.notificationsEnabled
										? 'Сначала включи уведомления'
										: 'Отправить тестовое письмо себе'}
							>
								<span className={s.navIcon}><NotificationsNoneIcon fontSize="small" /></span>
								<span className={s.navLabel}>
									{sendingTest ? 'Отправляем...' : 'Отправить тест-письмо'}
								</span>
							</button>
							{testMessage && (
								<div className={s.testMessage}>{testMessage}</div>
							)}
			<button className={s.navItem} onClick={toggleTheme} role="switch" aria-checked={theme === 'light'} aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}>
								<span className={s.navIcon}>{theme === 'dark' ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}</span>
								<span className={s.navLabel}>Тема</span>
				<span className={`${s.toggleTrack} ${theme === 'light' ? s.toggleChecked : ''}`} aria-hidden="true">
					<span className={s.toggleThumb} />
				</span>
							</button>
							<button className={s.navItem} disabled>
								<span className={s.navIcon}><LanguageIcon fontSize="small" /></span>
								<span className={s.navLabel}>Язык</span>
								<span className={s.soon}>Скоро</span>
							</button>
						</nav>

						<div className={s.spacer} />

						<div className={s.divider} />
						<button className={`${s.navItem} ${s.logoutItem}`} onClick={() => setLogoutConfirmOpen(true)}>
							<span className={s.navIcon}><LogoutIcon fontSize="small" /></span>
							<span className={s.navLabel}>Выйти из аккаунта</span>
						</button>
						<div className={s.divider} />

						{/* ── Socials + copyright ── */}
						<div className={s.footerBlock}>
							<div className={s.socials}>
								<a href="#" className={s.socialLink} aria-label="Telegram"><TelegramIcon style={{ fontSize: '1.1rem' }} /></a>
								<a href="#" className={s.socialLink} aria-label="X"><XIcon style={{ fontSize: '1.1rem' }} /></a>
								<a href="#" className={s.socialLink} aria-label="YouTube"><YouTubeIcon style={{ fontSize: '1.1rem' }} /></a>
								<a href="#" className={s.socialLink} aria-label="Instagram"><InstagramIcon style={{ fontSize: '1.1rem' }} /></a>
							</div>
							<p className={s.copyright}>2026 © Calm</p>
						</div>
					</div>

					{/* ── Edit profile sub-panel ── */}
					<div className={`${s.panel} ${view === 'edit' ? s.panelVisible : s.panelHiddenRight}`}>
						<div className={s.panelHeader}>
							<button className={s.iconBtn} onClick={handleBackToMain} aria-label="Назад">
								<BackIcon fontSize="small" />
							</button>
							<span className={s.panelTitle}>Редактирование</span>
						</div>

						{editData && (
											<form
								className={s.editForm}
												autoComplete="off"
								onSubmit={e => {
									e.preventDefault()
									handleSaveChanges(handleBackToMain)
								}}
							>
								<div className={s.editAvatarSection}>
									<label htmlFor="editAvatarUpload" className={s.avatarWrapper}>
										{tempAvatar ? (
											<img className={s.avatar} src={resolveAvatar(tempAvatar)} alt="Аватар" />
										) : (
											<div className={s.avatarPlaceholder}>
												<span className={s.initials}>{initials}</span>
											</div>
										)}
										<div className={s.avatarOverlay}>
											<PhotoCameraIcon style={{ fontSize: '1.25rem' }} />
										</div>
										<input
											type="file"
											id="editAvatarUpload"
											accept="image/*"
											className={s.fileInput}
											onChange={handleAvatarUpload}
										/>
									</label>
									{tempAvatar && (
										<button
											type="button"
											className={s.deleteAvatarBtn}
											onClick={handleAvatarDelete}
										>
											<DeleteIcon style={{ fontSize: '0.875rem' }} />
											Удалить фото
										</button>
									)}
								</div>

								<div className={s.formFields}>
									<Input
										id="name"
										type="text"
										label="Имя"
										placeholder="Ваше имя"
										value={editData.name}
										onChange={handleInputChange}
									/>
									<Input
										id="email"
										type="email"
										label="Электронная почта"
										placeholder="you@example.com"
										value={editData.email}
										onChange={handleInputChange}
									/>
								</div>

								<div className={s.passwordSection}>
									<span className={s.sectionLabel}>Смена пароля</span>
									<Input
										id="password"
												name="calm-profile-confirmation"
										type={showPassword ? 'text' : 'password'}
										label="Текущий пароль"
													autoComplete="new-password"
										placeholder="••••••••"
										value={editData.password}
										onChange={handleInputChange}
										error={passwordError}
										rightElement={
											<button
												type="button"
												onClick={() => setShowPassword(p => !p)}
												tabIndex={-1}
												aria-label={showPassword ? 'Скрыть' : 'Показать'}
											>
												{showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
											</button>
										}
									/>
									<Input
										id="newPassword"
										type={showNewPassword ? 'text' : 'password'}
										label="Новый пароль"
														autoComplete="new-password"
										placeholder="••••••••"
										value={editData.newPassword}
										onChange={handleInputChange}
										rightElement={
											<button
												type="button"
												onClick={() => setShowNewPassword(p => !p)}
												tabIndex={-1}
												aria-label={showNewPassword ? 'Скрыть' : 'Показать'}
											>
												{showNewPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
											</button>
										}
									/>
								</div>

								<Button type="submit" colored className={s.saveBtn}>
									Сохранить изменения
								</Button>
								<div className={s.deleteAccountSection}>
									<p>Удаление аккаунта безвозвратно удалит ваши записи и настройки.</p>
									<button type="button" className={s.deleteAccountButton} onClick={handleDeleteAccount}>
										<DeleteIcon fontSize="small" />
										Удалить аккаунт
									</button>
								</div>
							</form>
						)}
					</div>

					{/* ── Shared model pilot participation ── */}
					<div className={`${s.panel} ${view === 'participation' ? s.panelVisible : s.panelHiddenRight}`}>
						<div className={s.panelHeader}>
							<button className={s.iconBtn} onClick={handleBackToMain} aria-label="Назад">
								<BackIcon fontSize="small" />
							</button>
							<span className={s.panelTitle}>Пилот общей модели</span>
						</div>
						<div className={s.participationContent}>
							{loadingParticipation && <p>Загружаем статус…</p>}
							{!loadingParticipation && participation && (
								<>
									<p className={participation.participating ? s.participationOn : s.participationOff}>
										{participation.adminBlocked
											? 'Участие отключено администратором'
											: participation.participating
											? (participation.consentCurrent ? 'Участие включено' : 'Нужно обновить согласие')
												: 'Вы не участвуете'}
									</p>
									{participation.adminBlocked ? (
										<p className={s.participationNotice}>Администратор временно запретил участие. Если это ошибка, обратитесь к администратору.</p>
									) : participation.enrollmentOpen ? (
										<>
											{participation.consentText?.map((paragraph, index) => (
												<p key={index} className={index === participation.consentText.length - 1 ? s.participationNotice : undefined}>{paragraph}</p>
											))}
										</>
									) : (
										<p className={s.participationNotice}>Набор в пилот пока закрыт. Дневник работает как обычно. Когда условия участия будут готовы, здесь появится возможность принять решение.</p>
									)}
									{participation.adminBlocked ? null : participation.participating ? (
										<>
											{participation.enrollmentOpen && !participation.consentCurrent && (
												<button className={s.participationButton} onClick={() => changeParticipation(true)} disabled={savingParticipation}>
													{savingParticipation ? 'Сохраняем…' : 'Принять новые условия'}
												</button>
											)}
											<button className={s.participationButtonSecondary} onClick={() => changeParticipation(false)} disabled={savingParticipation}>
												{savingParticipation ? 'Сохраняем…' : 'Отозвать участие'}
											</button>
										</>
									) : participation.enrollmentOpen ? (
										<button className={s.participationButton} onClick={() => changeParticipation(true)} disabled={savingParticipation}>
											{savingParticipation ? 'Сохраняем…' : 'Согласиться участвовать'}
										</button>
									) : null}
								</>
							)}
							<ErrorNotice message={participationError} title="Не удалось изменить участие" />
						</div>
					</div>
				</div>
			</aside>

			{openMenu && <div className={s.overlay} onClick={handleClose} />}

			<LocationOnboarding
				open={locationModalOpen}
				onClose={() => setLocationModalOpen(false)}
				setUser={setUser}
			/>
			{verificationOpen && createPortal(
				<div className={s.verificationOverlay} onClick={event => event.target === event.currentTarget && setVerificationOpen(false)}>
					<section className={s.verificationDialog} role="dialog" aria-modal="true" aria-labelledby="emailVerificationTitle">
						<header className={s.verificationHeader}>
							<div>
								<h2 id="emailVerificationTitle">Подтвердите email</h2>
								<p>{user?.email}</p>
							</div>
							<button type="button" className={s.iconBtn} onClick={() => setVerificationOpen(false)} aria-label="Закрыть">
								<CloseIcon fontSize="small" />
							</button>
						</header>
						<p className={s.verificationHint}>Отправим на этот адрес четырёхзначный код. Он действует 5 минут.</p>
						<ErrorNotice message={verificationError} title="Не удалось подтвердить email" />
						<form className={s.verificationForm} onSubmit={verifyEmailCode}>
							<label htmlFor="emailVerificationCode">Код из письма</label>
							<input
								id="emailVerificationCode"
								className={s.verificationCodeInput}
								type="text"
								inputMode="numeric"
								autoComplete="one-time-code"
								pattern="[0-9]{4}"
								maxLength={4}
								value={verificationCode}
								onChange={event => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
								placeholder="0000"
								disabled={!verificationSent || verificationChecking}
								aria-describedby="emailVerificationCodeHint"
							/>
							<span id="emailVerificationCodeHint" className={s.verificationCodeHint}>
								{verificationSent ? 'Введите код из письма' : 'Сначала отправьте код на почту'}
							</span>
							<button
								type="button"
								className={s.verificationSendButton}
								onClick={sendVerificationCode}
								disabled={verificationSending || verificationCooldown > 0}
							>
								{verificationSending
									? 'Отправляем…'
									: verificationCooldown > 0
										? `Повторить через ${verificationCooldown} сек.`
										: verificationSent ? 'Отправить письмо повторно' : 'Отправить письмо'}
							</button>
							<button type="submit" className={s.verificationConfirmButton} disabled={!verificationSent || verificationCode.length !== 4 || verificationChecking}>
								{verificationChecking ? 'Проверяем…' : 'Подтвердить и включить уведомления'}
							</button>
						</form>
					</section>
				</div>,
				document.body,
			)}
			{logoutConfirmOpen && createPortal(
				<div className={s.verificationOverlay} onClick={event => event.target === event.currentTarget && !loggingOut && setLogoutConfirmOpen(false)}>
					<section className={`${s.verificationDialog} ${s.logoutConfirmDialog}`} role="dialog" aria-modal="true" aria-labelledby="logoutConfirmTitle">
						<p id="logoutConfirmTitle" className={s.logoutConfirmQuestion}>Вы действительно хотите выйти?</p>
						<div className={s.logoutConfirmActions}>
							<button type="button" className={s.logoutConfirmButton} onClick={handleLogout} disabled={loggingOut}>
								{loggingOut ? 'Выходим…' : 'Выйти'}
							</button>
							<button type="button" className={s.logoutConfirmStayButton} onClick={() => setLogoutConfirmOpen(false)} disabled={loggingOut}>Остаться</button>
						</div>
					</section>
				</div>,
				document.body,
			)}
		</>
	)
}

export default SidebarProfile
