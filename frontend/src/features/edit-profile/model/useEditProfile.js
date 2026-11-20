import { useRef, useState } from 'react'
import { http, userApi } from '@/shared/api'
import { questionnaireApi } from '@/shared/api/questionnaireApi'
import { emit, PROFILE_CHANGED } from '@/shared/lib/dataEvents'
import { updateCurrentUser } from '@/entities/user'
import { notifyRequestError } from '@/shared/lib/notifyError'

const makeEditData = user => ({
  name:        user?.name      || '',
  avatarUrl:   user?.avatarUrl || null,
  sex:'UNSPECIFIED', age:'', trackCycle:false, confirmPlannedCycle:true,
})

export const useEditProfile = ({ user, setUser }) => {
  const [open,          setOpen]          = useState(false)
  const [editData,      setEditData]      = useState(null)
  const [tempAvatar,    setTempAvatar]    = useState(null)
  const [profileError, setProfileError] = useState('')
  const [nameError, setNameError] = useState('')
  const [ageError, setAgeError] = useState('')
  const [saving,        setSaving]        = useState(false)
  const [profileLoading,setProfileLoading] = useState(false)
  const [profileLoaded,setProfileLoaded] = useState(false)
  const request=useRef(0), pending=useRef(false)

  const loadProfile = async () => {
    const id=++request.current
    setProfileLoading(true); setProfileLoaded(false); setProfileError(''); setAgeError('')
    try {
      const profile=await questionnaireApi.getProfile()
      if(id!==request.current) return
      setEditData(prev=>({...prev,sex:profile?.sex || 'UNSPECIFIED',age:profile?.age ?? '',trackCycle:profile?.trackCycle || false,
        confirmPlannedCycle: profile?.confirmPlannedCycle !== false }))
      setProfileLoaded(true)
    } catch(err) { if(id===request.current) notifyRequestError(err, 'Не удалось загрузить данные профиля') }
    finally { if(id===request.current) setProfileLoading(false) }
  }

  const openForm = () => {
    if(pending.current) return
    setEditData(makeEditData(user))
    setTempAvatar(user?.avatarUrl || null)
    setProfileError('')
    setNameError('')
    setOpen(true)
    loadProfile()
  }

  const closeForm = () => { if(pending.current) return false; ++request.current; setOpen(false); setProfileError(''); return true }

  const handleInputChange = e => {
    const { id, value, type, checked } = e.target
    if (id === 'name') setNameError('')
    if (id === 'age') setAgeError('')
    setEditData(prev => ({
      ...prev,
      [id]: type==='checkbox'?checked:value,
      ...(id === 'sex' && value !== 'FEMALE' ? { trackCycle: false } : {}),
    }))
  }

  const handleAvatarUpload = async e => {
    const file = e.target.files[0]
    if (!file) return
	e.target.value = ''

	if (file.size > 5 * 1024 * 1024) {
	  setProfileError('Размер фотографии не должен превышать 5 МБ')
	  return
	}
	if (!file.type.startsWith('image/')) {
	  setProfileError('Выберите файл изображения')
	  return
	}
	setProfileError('')

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
      if (err.status === 413) setProfileError(err.message)
      else notifyRequestError(err, 'Не удалось загрузить аватар')
    } finally {
      URL.revokeObjectURL(preview)
    }
  }

  const handleAvatarDelete = async () => {
    setProfileError('')
    try {
      await http.delete('/users/me/avatar')
      setTempAvatar(null)
      setEditData(prev => ({ ...prev, avatarUrl: null }))
      const merged = updateCurrentUser({ avatarUrl: null })
      setUser(merged)
    } catch (err) {
      notifyRequestError(err, 'Не удалось удалить аватар')
    }
  }

  const handleSaveChanges = async onSuccess => {
    if (!editData || pending.current || !profileLoaded) return
    const nameChanged = editData.name !== (user.name ?? '')
    const name = editData.name.trim()
    const age = editData.age === '' ? null : Number(editData.age)
    let nameValidationError = ''
    if (nameChanged && !name) nameValidationError = 'Укажите имя'
    else if (nameChanged && name.length > 64) nameValidationError = 'Имя должно быть не длиннее 64 символов'
    const ageValidationError = age !== null && (!/^\d+$/.test(editData.age) || age < 1 || age > 120)
      ? 'Укажите целый возраст от 1 до 120 лет или оставьте поле пустым' : ''
    setNameError(nameValidationError)
    setAgeError(ageValidationError)
    if (nameValidationError || ageValidationError) return
    pending.current=true; setSaving(true); setProfileError('')
    let nameSaved=false, succeeded=false
    try {
      let updated=user
      if (nameChanged) {
        updated=await userApi.updateMe({name})
        nameSaved=true
        const merged={...updated,avatarUrl:editData.avatarUrl}
        updateCurrentUser(merged);setUser(merged)
      }
      await questionnaireApi.profile({ sex:editData.sex, age, trackCycle:editData.sex === 'FEMALE' && editData.trackCycle,
        confirmPlannedCycle: editData.confirmPlannedCycle })
      emit(PROFILE_CHANGED)
      setOpen(false)
      succeeded=true
    } catch (err) {
      notifyRequestError(err, nameSaved ? 'Имя сохранено, данные дневника — нет' : 'Не удалось сохранить профиль')
    } finally {
      pending.current=false;setSaving(false)
    }
    if(succeeded) onSuccess?.()
  }

  return {
    open, editData, tempAvatar, profileError, nameError, ageError, saving, profileLoading, profileLoaded, loadProfile,
    openForm, closeForm,
    handleInputChange, handleAvatarUpload, handleAvatarDelete, handleSaveChanges,
  }
}
