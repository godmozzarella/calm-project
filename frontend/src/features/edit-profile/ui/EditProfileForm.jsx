import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { CloseIcon, UploadIcon } from '@/shared/ui/icons'

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
				autoComplete="off"
				onSubmit={e => {
					e.preventDefault()
					handleSaveChanges()
				}}
				className={s.editForm}
			>
				<div className={s.header}>
					<h2 className={s.title}>Редактирование профиля</h2>
					<button type="button" className={s.close} onClick={onClose} aria-label="Закрыть редактирование профиля" data-help="Закрыть настройки профиля без сохранения изменений.">
						<CloseIcon />
					</button>
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
					<label className={s.uploadAvatar} htmlFor="uploadAvatar" role="button" tabIndex={0}
						aria-label="Загрузить фотографию профиля" data-help="Выбрать фотографию профиля с этого устройства."
						onKeyDown={event => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault()
								document.getElementById('uploadAvatar')?.click()
							}
						}}>
						<UploadIcon />
					</label>
				</div>

				<Button
					type="button"
					className={s.deleteAvatar}
					onClick={handleAvatarDelete}
					data-help="Удалить фотографию профиля."
				>
					Удалить аватар
				</Button>

				<Input
					type="text"
					id="name"
					value={editData.name}
					onChange={handleInputChange}
					placeholder="Имя"
					data-help="Укажите имя, которое будет видно в вашем профиле."
				/>

				<Button type="submit" colored data-help="Сохранить изменённые данные профиля.">
					Сохранить
				</Button>
			</form>
			<div className={s.overlay} onClick={onClose} />
		</>
	)
}

export default EditProfileForm
