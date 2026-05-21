import { Button } from '@/shared/ui/Button'
import { CloseIcon, EditIcon } from '@/shared/ui/icons'
import { EditProfileForm, useEditProfile } from '@/features/edit-profile'

import s from './SidebarProfile.module.scss'

const SidebarProfile = props => {
	const { openMenu, setOpenMenu, user, setUser } = props

	const {
		open,
		editData,
		tempAvatar,
		openForm,
		closeForm,
		handleInputChange,
		handleAvatarUpload,
		handleAvatarDelete,
		handleSaveChanges
	} = useEditProfile({ user, setUser })

	return (
		<>
			<div className={`${s.sidebar} ${openMenu ? s.active : ''}`}>
				<span className={s.close} onClick={() => setOpenMenu(false)}>
					<CloseIcon />
				</span>
				<div className={s.list}>
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

					<p>{user?.name}</p>
					<p>{user?.email}</p>

					<a href="#">Статистика</a>

					<Button icon={<EditIcon />} colored onClick={openForm}>
						Настройки
					</Button>
				</div>
			</div>
			{openMenu && (
				<div className={s.overlay} onClick={() => setOpenMenu(false)} />
			)}

			<EditProfileForm
				user={user}
				open={open}
				onClose={closeForm}
				editData={editData}
				tempAvatar={tempAvatar}
				handleSaveChanges={handleSaveChanges}
				handleInputChange={handleInputChange}
				handleAvatarUpload={handleAvatarUpload}
				handleAvatarDelete={handleAvatarDelete}
			/>
		</>
	)
}

export default SidebarProfile
