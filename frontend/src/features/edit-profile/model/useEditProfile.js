import { useState } from 'react'
import { http, userApi, authApi } from '@/shared/api'
import { updateCurrentUser } from '@/entities/user'

const makeEditData = user => ({
  name:        user?.name      || '',
  email:       user?.email     || '',
  password:    '',
  newPassword: '',
  avatarUrl:   user?.avatarUrl || null,
})

export const useEditProfile = ({ user, setUser }) => {
  const [open,          setOpen]          = useState(false)
  const [editData,      setEditData]      = useState(null)
  const [tempAvatar,    setTempAvatar]    = useState(null)
  const [passwordError, setPasswordError] = useState('')
  const [saving,        setSaving]        = useState(false)

  const openForm = () => {
    setEditData(makeEditData(user))
    setTempAvatar(user?.avatarUrl || null)
    setPasswordError('')
    setOpen(true)
  }

  const closeForm = () => { setOpen(false); setPasswordError('') }

  const handleInputChange = e => {
    const { id, value } = e.target
    if (id === 'password') setPasswordError('')
    setEditData(prev => ({ ...prev, [id]: value }))
  }

  const handleAvatarUpload = async e => {
    const file = e.target.files[0]
    if (!file) return
	e.target.value = ''

	if (file.size > 5 * 1024 * 1024) {
	  setPasswordError('Размер фотографии не должен превышать 5 МБ')
	  return
	}
	if (!file.type.startsWith('image/')) {
	  setPasswordError('Выберите файл изображения')
	  return
	}
	setPasswordError('')

    // Показываем превью сразу (local blob URL)
    const preview = URL.createObjectURL(file)
    setTempAvatar(preview)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const { avatarUrl } = await http.postForm('/users/me/avatar', formData)
      setTempAvatar(avatarUrl)
      setEditData(prev => ({ ...prev, avatarUrl }))
      // Обновляем глобальное состояние сразу
      const merged = updateCurrentUser({ avatarUrl })
      setUser(merged)
    } catch (err) {
      setTempAvatar(user?.avatarUrl || null)
      setPasswordError(err.message ?? 'Ошибка загрузки аватара')
    } finally {
      URL.revokeObjectURL(preview)
    }
  }

  const handleAvatarDelete = async () => {
    setPasswordError('')
    try {
      await http.delete('/users/me/avatar')
      setTempAvatar(null)
      setEditData(prev => ({ ...prev, avatarUrl: null }))
      const merged = updateCurrentUser({ avatarUrl: null })
      setUser(merged)
    } catch (err) {
      setPasswordError(err.message ?? 'Ошибка удаления аватара')
    }
  }

  const handleSaveChanges = async onSuccess => {
    if (!editData) return

    const patch = { name: editData.name, email: editData.email }

		if (editData.email.trim().toLowerCase() !== user.email.trim().toLowerCase() && !editData.password) {
			setPasswordError('Для смены email введите текущий пароль')
			return
		}
		if (editData.password) patch.currentPassword = editData.password

    if (editData.newPassword) {
      if (!editData.password) { setPasswordError('Введите текущий пароль'); return }
      patch.newPassword     = editData.newPassword
    }

    setSaving(true)
    try {
      const updated = await userApi.updateMe(patch)
			if (editData.newPassword) {
				await authApi.logout()
				window.alert('Пароль изменён. Войдите снова.')
				window.location.assign('/')
				return
			}
      const merged = { ...updated, avatarUrl: editData.avatarUrl }
      updateCurrentUser(merged)
      setUser(merged)
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      setPasswordError(err.message ?? 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return {
    open, editData, tempAvatar, passwordError, saving,
    openForm, closeForm,
    handleInputChange, handleAvatarUpload, handleAvatarDelete, handleSaveChanges,
  }
}
