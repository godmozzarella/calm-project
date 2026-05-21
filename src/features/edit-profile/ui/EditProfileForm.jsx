import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { CloseIcon, UploadIcon } from '@/shared/ui/icons'
import { PASSWORD_PATTERN } from '@/shared/lib/validation'

import s from './EditProfileForm.module.scss'

const EditProfileForm = props => {
	const {
		user,
		open,
		onClose,
		editData,
		tempAvatar,
		handleSaveChanges,
		handleInputChange,
		handleAvatarUpload,
		handleAvatarDelete
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
				className={s.editForm}
			>
				<div className={s.header}>
					<h2 className={s.title}>Редактирование профиля</h2>
					<span className={s.close} onClick={onClose}>
						<CloseIcon />
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
						className={s.uploadAvatarInput}
					/>
					<label className={s.uploadAvatar} htmlFor="uploadAvatar">
						<UploadIcon />
					</label>
				</div>

				<Button
					type="button"
					className={s.deleteAvatar}
					onClick={handleAvatarDelete}
				>
					Удалить аватар
				</Button>

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
					pattern={PASSWORD_PATTERN}
					placeholder="Новый пароль"
				/>

				<Button type="submit" colored>
					Сохранить
				</Button>
			</form>
			<div className={s.overlay} onClick={onClose} />
		</>
	)
}

export default EditProfileForm
