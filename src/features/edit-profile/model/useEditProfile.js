import { useState } from 'react'

import { setCurrentUser } from '@/entities/user'

const makeEditData = user => ({
	name: user?.name || '',
	email: user?.email || '',
	password: '',
	newPassword: '',
	avatar: user?.avatar || null
})

export const useEditProfile = ({ user, setUser }) => {
	const [open, setOpen] = useState(false)
	const [editData, setEditData] = useState(null)
	const [tempAvatar, setTempAvatar] = useState(null)
	const [passwordError, setPasswordError] = useState('')

	const openForm = () => {
		setEditData(makeEditData(user))
		setTempAvatar(user?.avatar || null)
		setPasswordError('')
		setOpen(true)
	}

	const closeForm = () => {
		setOpen(false)
		setPasswordError('')
	}

	const handleInputChange = e => {
		const { id, value } = e.target
		if (id === 'password') setPasswordError('')
		setEditData(prev => ({ ...prev, [id]: value }))
	}

	const handleAvatarUpload = e => {
		const file = e.target.files[0]
		if (!file) return

		const reader = new FileReader()
		reader.onload = event => {
			const base64 = event.target.result
			setTempAvatar(base64)
			setEditData(prev => ({ ...prev, avatar: base64 }))
		}
		reader.readAsDataURL(file)
	}

	const handleAvatarDelete = () => {
		setTempAvatar(null)
		setEditData(prev => ({ ...prev, avatar: null }))
	}

	const handleSaveChanges = (onSuccess) => {
		if (!editData) return

		const updated = { ...user, name: editData.name, email: editData.email }

		if (editData.newPassword) {
			if (editData.password !== user.password) {
				setPasswordError('Неверный текущий пароль')
				return
			}
			updated.password = editData.newPassword
		}

		updated.avatar = editData.avatar

		setUser(updated)
		setCurrentUser(updated)
		setOpen(false)
		onSuccess?.()
	}

	return {
		open,
		editData,
		tempAvatar,
		passwordError,
		openForm,
		closeForm,
		handleInputChange,
		handleAvatarUpload,
		handleAvatarDelete,
		handleSaveChanges
	}
}
