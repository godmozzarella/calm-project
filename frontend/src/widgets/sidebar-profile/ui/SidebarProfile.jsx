import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import ContrastIcon from '@mui/icons-material/Contrast'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

import { FieldError, Input } from '@/shared/ui/Input'
import { notifyError, notifyRequestError } from '@/shared/lib/notifyError'
import { Button } from '@/shared/ui/Button'
import CloseButton from '@/shared/ui/Button/CloseButton'
import {
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
	ThreadsIcon,
	GitHubIcon,
	TelegramIcon,
	EditLocationIcon,
} from '@/shared/ui/icons'
import { useEditProfile } from '@/features/edit-profile'
import DiaryProfileFields from '@/features/edit-profile/ui/DiaryProfileFields'
import AccountSecuritySettings from '@/features/edit-profile/ui/AccountSecuritySettings'
import { LocationOnboarding } from '@/features/onboarding-location'
import { clearCurrentUser, setCurrentUser } from '@/entities/user'
import { authApi, userApi, riskApi } from '@/shared/api'
import { useTheme } from '@/app/providers/theme/themeContext'

import { useDeviceNotifications } from './useDeviceNotifications'
import s from './SidebarProfile.module.scss'

const SidebarProfile = ({ openMenu, setOpenMenu, user, setUser, onStartTour }) => {
	const { themePreference, setThemePreference } = useTheme()
	const themeSelectRef = useRef(null)
	const panelsRef = useRef(null)
	const navigate = useNavigate()
	const [view, setView] = useState('main')
	const [locationModalOpen, setLocationModalOpen] = useState(false)
	const [togglingNotif, setTogglingNotif] = useState(false)
	const deviceNotifications = useDeviceNotifications(openMenu, user?.id)
	const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
	const [loggingOut, setLoggingOut] = useState(false)
	const [participation, setParticipation] = useState(null)
	const [loadingParticipation, setLoadingParticipation] = useState(false)
	const [savingParticipation, setSavingParticipation] = useState(false)

	useLayoutEffect(() => {
		if (!openMenu) return
		for (const panel of panelsRef.current.children) panel.scrollTop = 0
	}, [openMenu])

	const openThemeOptions = event => {
		if (event.target.closest('select')) return
		const select = themeSelectRef.current
		if (!select) return
		if (typeof select.showPicker === 'function') select.showPicker()
		else { select.focus(); select.click() }
	}
	const themeIcon = themePreference === 'auto'
		? <ContrastIcon fontSize="small" aria-hidden="true" />
		: themePreference === 'light' ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />


	const openParticipation = async () => {
		setView('participation')
		setLoadingParticipation(true)
		try {
			setParticipation(await riskApi.getParticipation())
		} catch (e) {
			notifyRequestError(e, 'Не удалось загрузить статус участия')
		} finally {
			setLoadingParticipation(false)
		}
	}

	const changeParticipation = async join => {
		if (savingParticipation) return
		setSavingParticipation(true)
		try {
			const result = join
				? await riskApi.joinSharedModelPilot(participation.currentConsentVersion, participation.currentConsentDigest)
				: await riskApi.withdrawSharedModelPilot()
			setParticipation(result)
		} catch (e) {
			notifyRequestError(e, 'Не удалось сохранить решение')
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
			notifyError('Войдите снова и подтвердите адрес по письму.', 'Не удалось включить email-уведомления')
			return
		}
		setTogglingNotif(true)
		try {
			const updated = await userApi.updateMe({ notificationsEnabled: !user.notificationsEnabled })
			setCurrentUser(updated)
			setUser(updated)
		} catch (error) {
			notifyRequestError(error, 'Не удалось изменить email-уведомления')
		} finally {
			setTogglingNotif(false)
		}
	}

	const {
		editData,
		tempAvatar,
		profileError, nameError, ageError,
		saving, profileLoading, profileLoaded, loadProfile,
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
		setView('main')
		closeForm()
	}

	const handleOpenEdit = () => {
		openForm()
		setView('edit')
	}

	const handleBackToMain = () => {
		if(closeForm()===false) return
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
			notifyRequestError(e, 'Не удалось удалить аккаунт')
		}
	}

	return (
		<>
			<aside className={`${s.sidebar} ${openMenu ? s.active : ''}`}>
				<div className={s.panels} ref={panelsRef}>
					{/* ── Main panel ── */}
					<div className={`${s.panel} ${view === 'main' ? s.panelVisible : s.panelHiddenLeft}`}>
						<div className={s.panelHeader}>
							<span className={s.panelTitle}>Профиль</span>
							<CloseButton onClick={handleClose} />
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
							<button className={s.navItem} onClick={handleOpenEdit} title="Открыть настройки имени, почты и других данных профиля.">
								<span className={s.navIcon}><PersonIcon fontSize="small" /></span>
								<span className={s.navLabel}>Редактировать профиль</span>
								<span className={s.navChevron}><ChevronRightIcon fontSize="small" /></span>
							</button>
						<Link to="/stats" state={{ from: 'menu' }} className={s.navItem} onClick={handleClose} title="Открыть статистику приступов, препаратов и дней без приступа.">
								<span className={s.navIcon}><AnalyticsIcon fontSize="small" /></span>
								<span className={s.navLabel}>Статистика</span>
								<span className={s.navChevron}><ChevronRightIcon fontSize="small" /></span>
							</Link>
							{user?.role === 'ADMIN' && (
								<Link to="/admin" className={s.navItem} onClick={handleClose} title="Открыть настройки и данные администратора.">
									<span className={s.navIcon}><SecurityIcon fontSize="small" /></span>
									<span className={s.navLabel}>Админка</span>
									<span className={s.navChevron}><ChevronRightIcon fontSize="small" /></span>
								</Link>
							)}
						</nav>

						<div className={s.sectionDivider}><span>Настройки</span></div>
						<nav className={s.navSection}>
							<button className={s.navItem} onClick={openParticipation} title="Узнать об участии в общей модели и при желании изменить своё согласие.">
								<span className={s.navIcon}><AnalyticsIcon fontSize="small" /></span>
								<span className={s.navLabel}>Пилот общей модели</span>
								<span className={s.navChevron}><ChevronRightIcon fontSize="small" /></span>
							</button>
							<button
								className={s.navItem}
								onClick={() => setLocationModalOpen(true)}
								title={user?.city ? `${user.city}. Выбрать город для погодного прогноза и оценки риска приступа.` : 'Выбрать город для погодного прогноза и оценки риска приступа.'}
							>
								<span className={s.navIcon}><EditLocationIcon fontSize="small" /></span>
								<span className={s.navLabel}>Город для прогноза</span>
								<span className={s.navHint}>{user?.city || 'не задан'}</span>
								<span className={s.navChevron}><ChevronRightIcon fontSize="small" /></span>
							</button>

							<div className={`${s.navItem} ${s.themeSelectItem}`} onClick={openThemeOptions} title="Выбрать автоматическую, светлую или тёмную тему приложения.">
								<span className={s.navIcon}>{themeIcon}</span>
								<span className={s.navLabel}>Тема</span>
								<select ref={themeSelectRef} id="profile-theme-select" className={s.themeSelect} aria-label="Тема оформления" value={themePreference} onChange={event => setThemePreference(event.target.value)}>
									<option value="auto">Авто</option>
									<option value="light">Светлая</option>
									<option value="dark">Тёмная</option>
								</select>
							</div>
							<button className={s.navItem} disabled>
								<span className={s.navIcon}><LanguageIcon fontSize="small" /></span>
								<span className={s.navLabel}>Язык</span>
								<span className={s.soon}>Скоро</span>
							</button>
						</nav>

						<div className={s.sectionDivider}><span>Уведомления</span></div>
						<nav className={s.navSection} aria-label="Уведомления">
							<button
								className={s.navItem}
								onClick={toggleNotifications}
								disabled={togglingNotif}
								role="switch"
								aria-checked={Boolean(user?.emailVerified && user?.notificationsEnabled)}
								title="Получать прогноз и напоминания дневника на электронную почту."
							>
								<span className={s.navIcon}><NotificationsNoneIcon fontSize="small" /></span>
								<span className={s.navLabel}>Email-уведомления</span>
								<span className={`${s.toggleTrack} ${user?.emailVerified && user?.notificationsEnabled ? s.toggleChecked : ''}`} aria-hidden="true">
									<span className={s.toggleThumb} />
								</span>
							</button>
							<button
								className={s.navItem}
								onClick={deviceNotifications.toggle}
								disabled={deviceNotifications.busy}
								role="switch"
								aria-checked={deviceNotifications.enabled}
								title="Получать прогноз и напоминания дневника на этом устройстве."
							>
								<span className={s.navIcon}><NotificationsNoneIcon fontSize="small" /></span>
								<span className={s.navLabel}>Уведомления на устройстве</span>
								<span className={`${s.toggleTrack} ${deviceNotifications.enabled ? s.toggleChecked : ''}`} aria-hidden="true">
									<span className={s.toggleThumb} />
								</span>
							</button>
							{deviceNotifications.enabled && user?.latitude == null && (
								<p className={s.notificationHint}>Укажите город, чтобы получать прогноз на этом устройстве.</p>
							)}
						</nav>
						<div className={s.navSection}>
							<button type="button" className={s.navItem} onClick={onStartTour}>
								<span className={s.navIcon}><HelpOutlineIcon fontSize="small" /></span>
								<span className={s.navLabel}>Запустить обучение</span>
							</button>
						</div>

						<div className={s.spacer} />

						<div className={s.divider} />
						<div className={s.navSection}>
							<button className={`${s.navItem} ${s.logoutItem}`} onClick={() => setLogoutConfirmOpen(true)} title="Завершить сеанс и выйти из своего аккаунта на этом устройстве.">
								<span className={s.navIcon}><LogoutIcon fontSize="small" /></span>
								<span className={s.navLabel}>Выйти из аккаунта</span>
							</button>
						</div>
						<div className={s.divider} />

						{/* ── Socials + copyright ── */}
						<div className={s.footerBlock}>
							<div className={s.socials}>
								<a title="Telegram" href="https://t.me/calm_prj" className={s.socialLink} aria-label="Telegram"><TelegramIcon style={{ fontSize: '1.1rem' }} /></a>
								<a title="Threads" href="https://www.threads.com/@calm.prj?igshid=NTc4MTIwNjQ2YQ==" className={s.socialLink} aria-label="Threads"><ThreadsIcon style={{ fontSize: '1.1rem' }} /></a>
								<a title="GitHub" href="https://github.com/godmozzarella/calm-project" className={s.socialLink} aria-label="GitHub"><GitHubIcon style={{ fontSize: '1.1rem' }} /></a>
							</div>
							<p className={s.copyright}>2026 © Calm</p>
						</div>
					</div>

					{/* ── Edit profile sub-panel ── */}
					<div className={`${s.panel} ${s.editPanel} ${view === 'edit' ? s.panelVisible : s.panelHiddenRight}`}>
						<div className={s.panelHeader}>
							<button title="Назад" className={`${s.iconBtn} ${s.editBackBtn}`} onClick={handleBackToMain} aria-label="Назад">
								<BackIcon fontSize="small" />
							</button>
						<span className={s.panelTitle}>Профиль</span>
						</div>

						{editData && (
							<form
								className={s.editForm}
								autoComplete="off"
								noValidate
								onSubmit={e => {
									e.preventDefault()
									handleSaveChanges(handleBackToMain)
								}}
							>
								<div className={s.editSectionHeading}>
									<h2>Основное</h2>
								</div>
								<div className={s.editIdentityCard}>
									<div className={s.editAvatarSection}>
										<FieldError>{profileError}</FieldError>
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
											<input title="Загрузить фото профиля"
												type="file"
												id="editAvatarUpload"
												accept="image/*"
												aria-label="Загрузить фото профиля"
												className={s.fileInput}
												onChange={handleAvatarUpload}
											/>
										</label>
									{tempAvatar && (
										<button title={"Удалить фото"}
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
											error={nameError}
										/>
									</div>
								</div>
								<DiaryProfileFields data={editData} onChange={handleInputChange} loading={profileLoading} loaded={profileLoaded} saving={saving} onRetry={loadProfile} ageError={ageError}/>

								<Button type="submit" colored className={s.saveBtn} disabled={saving || !profileLoaded}>
									{saving?'Сохраняем…':'Сохранить изменения'}
								</Button>
							</form>
						)}
						{editData && <AccountSecuritySettings user={user} />}
						{editData && <div className={`${s.deleteAccountSection} ${s.securityDeleteAccount}`}>
							<button title={"Удалить аккаунт"} type="button" className={s.deleteAccountButton} onClick={handleDeleteAccount}>
								<DeleteOutlineIcon fontSize="small" />
								Удалить аккаунт
							</button>
						</div>}
					</div>

					{/* ── Shared model pilot participation ── */}
					<div className={`${s.panel} ${view === 'participation' ? s.panelVisible : s.panelHiddenRight}`}>
						<div className={s.panelHeader}>
							<button title="Назад" className={s.iconBtn} onClick={handleBackToMain} aria-label="Назад">
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
						</div>
					</div>
				</div>
			</aside>

			{openMenu && <div className={s.overlay} onClick={handleClose} />}

			<LocationOnboarding
				open={locationModalOpen}
				onClose={() => setLocationModalOpen(false)}
				setUser={setUser}
				currentCity={user?.city}
			/>
			{logoutConfirmOpen && createPortal(
				<div className={s.verificationOverlay} onClick={event => event.target === event.currentTarget && !loggingOut && setLogoutConfirmOpen(false)}>
					<section className={`${s.verificationDialog} ${s.logoutConfirmDialog}`} role="dialog" aria-modal="true" aria-labelledby="logoutConfirmTitle">
						<p id="logoutConfirmTitle" className={s.logoutConfirmQuestion}>Вы действительно хотите выйти?</p>
						<div className={s.logoutConfirmActions}>
							<button type="button" className={s.logoutConfirmButton} onClick={handleLogout} disabled={loggingOut}>
								{loggingOut ? 'Выходим…' : 'Выйти'}
							</button>
							<button title={"Остаться"} type="button" className={s.logoutConfirmStayButton} onClick={() => setLogoutConfirmOpen(false)} disabled={loggingOut}>Остаться</button>
						</div>
					</section>
				</div>,
				document.body,
			)}
		</>
	)
}

export default SidebarProfile
