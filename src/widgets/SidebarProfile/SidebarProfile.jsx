import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import EditProfile from '../../entities/FormEditProfile/FormEditProfile.jsx'
import Button from '../../shared/Button/Button.jsx'

import { CloseIcon, EditIcon } from '../../assets/icons.js'
import s from './SidebarProfile.module.scss'

const SidebarProfile = props => {
	const { openMenu, setOpenMenu, user, setUser } = props

	const navigate = useNavigate()

	const [editProfileOpen, setEditProfileOpen] = useState(false)
	const [editData, setEditData] = useState(null)

	const [tempAvatar, setTempAvatar] = useState(null)

	const handleInputChange = e => {
		const { id, value } = e.target
		console.log(id, value)

		setEditData(prev => ({
			...prev,
			[id]: value
		}))
	}

	const handleAvatarUpload = e => {
		const file = e.target.files[0]
		if (!file) return

		const reader = new FileReader()
		reader.onload = event => {
			const base64 = event.target.result

			setTempAvatar(base64)

			setEditData(prev => ({
				...prev,
				avatar: base64
			}))
		}

		reader.readAsDataURL(file)
	}

	const handleAvatarDelete = () => {
		setTempAvatar(null)

		setEditData(prev => ({
			...prev,
			avatar: null
		}))
	}

	const handleSaveChanges = () => {
		if (!editData) return

		let updatedUser = { ...user }

		updatedUser.name = editData.name
		updatedUser.email = editData.email

		if (editData.newPassword) {
			if (editData.password !== user.password) {
				alert('Неверный текущий пароль')
				return
			}
			updatedUser.password = editData.newPassword
		}

		updatedUser.avatar = editData.avatar

		finalizeUpdate(updatedUser)
	}

	const finalizeUpdate = updatedUser => {
		setUser(updatedUser)
		localStorage.setItem('currentUser', JSON.stringify(updatedUser))
		setEditProfileOpen(false)
	}

	useEffect(() => {
		const user = JSON.parse(localStorage.getItem('currentUser'))
		if (!user) navigate('/')
	}, [navigate])

	return (
		<>
			<div className={`${s.sidebar} ${openMenu ? s.active : ''}`}>
				<span
					className={s.close}
					onClick={() => setOpenMenu(false)}
				>
					{<CloseIcon />}
				</span>
				<div className={s.list}>
					{/* Иконка профиля */}
					{user?.avatar ? (
						<img
							className={s.profileIconImage}
							src={user.avatar}
							alt="Profile"
						/>
					) : (
						<div className={s.profileBaseIcon}>
							<span className={s.profileLetter}>{user?.name?.[0]}</span>
						</div>
					)}

					{/* Имя и email */}
					<p>{user?.name}</p>
					<p>{user?.email}</p>

					{/* Статистика */}
					<a href="#">Статистика</a>

					{/* Настройки */}
					<Button
						icon={<EditIcon />}
						colored
						text="Настройки"
						onClick={() => {
							setEditData({
								name: user?.name || '',
								email: user?.email || '',
								password: '',
								newPassword: '',
								avatar: user?.avatar || null
							})
							setTempAvatar(user?.avatar || null)
							setEditProfileOpen(true)
						}}
					/>
				</div>
			</div>
			{openMenu && (
				<div
					className={s.overlay}
					onClick={() => setOpenMenu(false)}
				/>
			)}

			<EditProfile
				user={user}
				open={editProfileOpen}
				onClose={() => setEditProfileOpen(false)}
				editData={editData}
				handleSaveChanges={handleSaveChanges}
				handleInputChange={handleInputChange}
				handleAvatarDelete={handleAvatarDelete}
				handleAvatarUpload={handleAvatarUpload}
				tempAvatar={tempAvatar}
				setTempAvatar={setTempAvatar}
			/>
		</>
	)
}

export default SidebarProfile
