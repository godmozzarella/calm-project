import {useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EditProfile from '../FormEditProfile/FormEditProfile.jsx'
import Button from '../Button/Button';

import {EditIcon} from '../../assets/icons.js'
import s from './SidebarProfile.module.scss'

const SidebarProfile = (props) => {

	const { 
			openMenu, 
			setOpenMenu,
			closeIcon,
			user,
			setUser
		} = props;

		const navigate = useNavigate();
		const [editProfileOpen, setEditProfileOpen] = useState(false);
		const [tempAvatar, setTempAvatar] = useState(null);
		const [selectedFile, setSelectedFile] = useState(null);
		
		useEffect(() => {
			const user = JSON.parse(localStorage.getItem("currentUser"));
			if (!user) navigate("/");
		}, [navigate]);

		// выбор фото
		const handleAvatarChange = (e) => {
				const file = e.target.files[0];
				if (!file) return;

				const objectUrl = URL.createObjectURL(file);
				setTempAvatar(objectUrl);  // для превью
				setSelectedFile(file);      // для сохранения при нажатии "Сохранить"
		};

    return (
        <>
					<div className={`${s.sidebar} ${openMenu ? s.active : ""}`}>
						<span className={s.close} onClick={() => setOpenMenu(false)}>{closeIcon}</span>
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
									<span className={s.profileLetter}>{user?.email?.[0]}</span>
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
								onClick={() => setEditProfileOpen(true)}
							/>
						</div>
							
					</div>
					{openMenu && <div className={s.overlay} onClick={() => setOpenMenu(false)} />}

					<EditProfile
						open={editProfileOpen}
						onClose={() => setEditProfileOpen(false)}
						user={user}
						setUser={setUser}
						closeIcon={closeIcon}
						onPhotoUpload={handleAvatarChange}
						tempAvatar={tempAvatar}
						selectedFile={selectedFile}
						setTempAvatar={setTempAvatar}
						setSelectedFile={setSelectedFile}
					/>
        </>
    )
}

export default SidebarProfile