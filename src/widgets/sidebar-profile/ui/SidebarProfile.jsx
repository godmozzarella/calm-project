import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Input } from '@/shared/ui/Input'
import { Button } from '@/shared/ui/Button'
import {
	CloseIcon,
	ChevronRightIcon,
	ArrowBackIcon,
	PersonIcon,
	AnalyticsIcon,
	LogoutIcon,
	PhotoCameraIcon,
	DeleteIcon,
	NotificationsNoneIcon,
	DarkModeOutlinedIcon,
	LanguageIcon,
	VisibilityIcon,
	VisibilityOffIcon,
} from '@/shared/ui/icons'
import { useEditProfile } from '@/features/edit-profile'
import { clearCurrentUser } from '@/entities/user'

import s from './SidebarProfile.module.scss'

const SidebarProfile = ({ openMenu, setOpenMenu, user, setUser }) => {
	const navigate = useNavigate()
	const [view, setView] = useState('main')
	const [showPassword, setShowPassword] = useState(false)
	const [showNewPassword, setShowNewPassword] = useState(false)

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

	const handleLogout = () => {
		clearCurrentUser()
		navigate('/')
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
							<label htmlFor="quickAvatarUpload" className={s.avatarWrapper}>
								{user?.avatar ? (
									<img className={s.avatar} src={user.avatar} alt="Аватар" />
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
									id="quickAvatarUpload"
									accept="image/*"
									className={s.fileInput}
									onChange={e => {
										handleOpenEdit()
										handleAvatarUpload(e)
									}}
								/>
							</label>
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
							<button className={s.navItem}>
								<span className={s.navIcon}><AnalyticsIcon fontSize="small" /></span>
								<span className={s.navLabel}>Статистика</span>
								<span className={s.navChevron}><ChevronRightIcon fontSize="small" /></span>
							</button>
						</nav>

						<div className={s.divider} />

						<div className={s.sectionLabel}>Настройки</div>
						<nav className={s.navSection}>
							<button className={s.navItem} disabled>
								<span className={s.navIcon}><NotificationsNoneIcon fontSize="small" /></span>
								<span className={s.navLabel}>Уведомления</span>
								<span className={s.soon}>Скоро</span>
							</button>
							<button className={s.navItem} disabled>
								<span className={s.navIcon}><DarkModeOutlinedIcon fontSize="small" /></span>
								<span className={s.navLabel}>Тема</span>
								<span className={s.soon}>Скоро</span>
							</button>
							<button className={s.navItem} disabled>
								<span className={s.navIcon}><LanguageIcon fontSize="small" /></span>
								<span className={s.navLabel}>Язык</span>
								<span className={s.soon}>Скоро</span>
							</button>
						</nav>

						<div className={s.spacer} />

						<div className={s.divider} />
						<button className={`${s.navItem} ${s.logoutItem}`} onClick={handleLogout}>
							<span className={s.navIcon}><LogoutIcon fontSize="small" /></span>
							<span className={s.navLabel}>Выйти из аккаунта</span>
						</button>
					</div>

					{/* ── Edit profile sub-panel ── */}
					<div className={`${s.panel} ${view === 'edit' ? s.panelVisible : s.panelHiddenRight}`}>
						<div className={s.panelHeader}>
							<button className={s.iconBtn} onClick={handleBackToMain} aria-label="Назад">
								<ArrowBackIcon fontSize="small" />
							</button>
							<span className={s.panelTitle}>Редактирование</span>
						</div>

						{editData && (
							<form
								className={s.editForm}
								onSubmit={e => {
									e.preventDefault()
									handleSaveChanges(handleBackToMain)
								}}
							>
								<div className={s.editAvatarSection}>
									<label htmlFor="editAvatarUpload" className={s.avatarWrapper}>
										{tempAvatar ? (
											<img className={s.avatar} src={tempAvatar} alt="Аватар" />
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
										type={showPassword ? 'text' : 'password'}
										label="Текущий пароль"
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
							</form>
						)}
					</div>
				</div>
			</aside>

			{openMenu && <div className={s.overlay} onClick={handleClose} />}
		</>
	)
}

export default SidebarProfile
