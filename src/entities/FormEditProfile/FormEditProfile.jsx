import { CloseIcon, UploadIcon } from '../../assets/icons'

import Button from '../../shared/Button/Button'
import Input from '../../shared/Input/Input'

import s from './FormEditProfile.module.scss'

const EditProfile = props => {
	const {
		user,
		open,
		onClose,
		editData,
		handleSaveChanges,
		handleInputChange,
		handleAvatarUpload,
		handleAvatarDelete,
		tempAvatar
	} = props

	if (!open || !editData) {
		return null
	}

	return (
		<>
			<form
				onSubmit={e => {
					e.preventDefault()
					handleSaveChanges()
				}}
				className={open ? s.editForm : s.hidden}
			>
				<div className={s.header}>
					<h2 className={s.title}>Редактирование профиля</h2>
					<span
						className={s.close}
						onClick={() => onClose()}
					>
						{<CloseIcon />}
					</span>
				</div>

				<div className={s.avatarContainer}>
					{tempAvatar ? (
						<img
							className={s.profileIconImage}
							src={tempAvatar}
							alt="Preview"
						/>
					) : (
						<div className={s.profileBaseIcon}>
							<span className={s.profileLetter}>
								{user?.name?.[0] || user?.email?.[0]}
							</span>
						</div>
					)}

					<Input
						type="file"
						accept="image/*"
						id="uploadAvatar"
						value=""
						onChange={handleAvatarUpload}
						className={`${s.uploadAvatarInput}`}
					/>
					<label
						className={s.uploadAvatar}
						htmlFor="uploadAvatar"
					>
						<UploadIcon />{' '}
					</label>
				</div>

				<Button
					type="button"
					children={'Удалить аватар'}
					className={`${s.deleteAvatar}`}
					onClick={handleAvatarDelete}
				/>

				<Input
					type="text"
					id="name"
					value={editData.name}
					onChange={handleInputChange}
					placeholder="Имя"
				/>

				<Input
					type="email"
					id="email"
					value={editData.email}
					onChange={handleInputChange}
					placeholder="Email"
				/>

				<Input
					type="password"
					id="password"
					value={editData.password}
					onChange={handleInputChange}
					placeholder="Пароль"
				/>

				<Input
					type="password"
					id="newPassword"
					value={editData.newPassword}
					onChange={handleInputChange}
					pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#_@$!%*?&])[A-Za-z\d#_@$!%*?&]{8,}$"
					placeholder="Новый пароль"
				/>
				<Button
					type="submit"
					colored
					children="Сохранить"
				/>
			</form>
			{open && (
				<div
					className={s.overlay}
					onClick={() => onClose()}
				/>
			)}
		</>
	)
}

export default EditProfile
