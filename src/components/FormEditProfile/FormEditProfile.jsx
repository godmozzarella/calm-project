import Input from "../Input/Input";
import Button from "../Button/Button";
import s from "./FormEditProfile.module.scss";

const EditProfile = (props) => {
    const { 
			user,
			setUser,
			onSubmit,
			onPhotoUpload,
			onPhotoDelete,
			open,
			onClose,
			closeIcon,
			tempAvatar,
			selectedFile,
			setTempAvatar,
			setSelectedFile
		 } = props;
    return (
			<>
			<form onSubmit={onSubmit} className={open ? s.editForm : s.hidden}>
					<h2>Редактирование профиля</h2>
					<span className={s.close} onClick={() => onClose()}>{closeIcon}</span>

					
					<div className={s.avatarContainer}>
						{tempAvatar ? (
								<img className={s.profileIconImage} src={tempAvatar} alt="Preview" />
						) : user?.avatar ? (
								<img className={s.profileIconImage} src={user.avatar} alt="Profile" />
						) : (
								<div className={s.profileBaseIcon}>
										<span className={s.profileLetter}>{user?.name?.[0] || user?.email?.[0]}</span>
								</div>
						)}
					</div>

					<div className={s.photoActions}>
						<Input
							type="file"
							accept="image/*"
							id="uploadPhoto"
							value=""
							onChange={onPhotoUpload}
							className={`${s.uploadPhoto}`}
						/>
						<label className={s.editButton} htmlFor="uploadPhoto">Загрузить фото</label>
						<Button
							children={"Удалить фото"}
							className={`${s.editButton}`}
							onClick={onPhotoDelete}
						/>
					</div>

					<Input 	
						type="text"
						placeholder="Имя"
						id="name"
						value={user?.name || ""}
						onChange={() => {}}
					/>
					
					<Input 
						type="email"
						placeholder="Электронная почта"
						id="email"
						value={user?.email || ""}
						onChange={() => {}}
					/>
					<Input 
						type="password"
						placeholder="Введите действующий пароль"
						id="password"
						value={""}
						onChange={() => {}}
					/>
					<Input 
						type="password"
						placeholder="Новый пароль"
						id="newPassword"
						value=""
						onChange={() => {}}
					/>
					<Button
					type="button"
						colored
						children="Сохранить"
						onClick={() => {
								if (selectedFile) {
										const AVATAR_SIZE = 128;
										const img = new Image();
										const objectUrl = URL.createObjectURL(selectedFile);

										img.onload = () => {
												const canvas = document.createElement("canvas");
												canvas.width = AVATAR_SIZE;
												canvas.height = AVATAR_SIZE;
												const ctx = canvas.getContext("2d");
												const scale = Math.max(AVATAR_SIZE / img.width, AVATAR_SIZE / img.height);
												const newWidth = img.width * scale;
												const newHeight = img.height * scale;
												const offsetX = (AVATAR_SIZE - newWidth) / 2;
												const offsetY = (AVATAR_SIZE - newHeight) / 2;
												ctx.drawImage(img, offsetX, offsetY, newWidth, newHeight);
												const resizedImage = canvas.toDataURL("image/png");

												const updatedUser = { ...user, avatar: resizedImage };
												setUser(updatedUser);
												localStorage.setItem("currentUser", JSON.stringify(updatedUser));

												URL.revokeObjectURL(objectUrl);
												setTempAvatar(null);
												setSelectedFile(null);
										};
										img.src = objectUrl;
								}
								onClose();
							}}
						/>
							
        </form>
				{open && <div className={s.overlay} onClick={() => onClose()} />}
			</>
        
    );
};

export default EditProfile;