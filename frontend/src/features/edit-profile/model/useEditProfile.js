import { useState } from 'react'
import { http, userApi } from '@/shared/api'
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

    if (editData.newPassword) {
      if (!editData.password) { setPasswordError('Введите текущий пароль'); return }
      patch.currentPassword = editData.password
      patch.newPassword     = editData.newPassword
    }

    setSaving(true)
    try {
      const updated = await userApi.updateMe(patch)
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
