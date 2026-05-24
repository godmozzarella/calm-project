import { useState } from 'react'
import { userApi } from '@/shared/api'
import { updateCurrentUser } from '@/entities/user'

const makeEditData = user => ({
  name:        user?.name     || '',
  email:       user?.email    || '',
  password:    '',
  newPassword: '',
  avatar:      user?.avatar   || null,
})

export const useEditProfile = ({ user, setUser }) => {
  const [open,          setOpen]          = useState(false)
  const [editData,      setEditData]      = useState(null)
  const [tempAvatar,    setTempAvatar]    = useState(null)
  const [passwordError, setPasswordError] = useState('')
  const [saving,        setSaving]        = useState(false)

  const openForm = () => {
    setEditData(makeEditData(user))
    setTempAvatar(user?.avatar || null)
    setPasswordError('')
    setOpen(true)
  }

  const closeForm = () => { setOpen(false); setPasswordError('') }

  const handleInputChange = e => {
    const { id, value } = e.target
    if (id === 'password') setPasswordError('')
    setEditData(prev => ({ ...prev, [id]: value }))
  }

  const handleAvatarUpload = e => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const base64 = ev.target.result
      setTempAvatar(base64)
      setEditData(prev => ({ ...prev, avatar: base64 }))
    }
    reader.readAsDataURL(file)
  }

  const handleAvatarDelete = () => {
    setTempAvatar(null)
    setEditData(prev => ({ ...prev, avatar: null }))
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
      // avatar хранится локально (загрузка на сервер — будущая фича)
      const merged = { ...updated, avatar: editData.avatar }
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
