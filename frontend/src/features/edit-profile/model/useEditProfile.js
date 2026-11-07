import { useRef, useState } from 'react'
import { http, userApi } from '@/shared/api'
import { questionnaireApi } from '@/shared/api/questionnaireApi'
import { emit, PROFILE_CHANGED } from '@/shared/lib/dataEvents'
import { updateCurrentUser } from '@/entities/user'
import { isCentralError } from '@/shared/lib/isCentralError'

const makeEditData = user => ({
  name:        user?.name      || '',
  avatarUrl:   user?.avatarUrl || null,
  sex:'UNSPECIFIED', age:'', trackCycle:false,
})

export const useEditProfile = ({ user, setUser }) => {
  const [open,          setOpen]          = useState(false)
  const [editData,      setEditData]      = useState(null)
  const [tempAvatar,    setTempAvatar]    = useState(null)
  const [passwordError, setPasswordError] = useState('')
  const [saving,        setSaving]        = useState(false)
  const [profileLoading,setProfileLoading] = useState(false)
  const [profileLoaded,setProfileLoaded] = useState(false)
  const request=useRef(0), pending=useRef(false)

  const loadProfile = async () => {
    const id=++request.current
    setProfileLoading(true); setProfileLoaded(false); setPasswordError('')
    try {
      const profile=await questionnaireApi.getProfile()
      if(id!==request.current) return
      setEditData(prev=>({...prev,sex:profile?.sex || 'UNSPECIFIED',age:profile?.age ?? '',trackCycle:profile?.trackCycle || false}))
      setProfileLoaded(true)
    } catch(err) { if(id===request.current && !isCentralError(err)) setPasswordError(err.message || 'Не удалось загрузить данные профиля') }
    finally { if(id===request.current) setProfileLoading(false) }
  }

  const openForm = () => {
    if(pending.current) return
    setEditData(makeEditData(user))
    setTempAvatar(user?.avatarUrl || null)
    setPasswordError('')
    setOpen(true)
    loadProfile()
  }

  const closeForm = () => { if(pending.current) return false; ++request.current; setOpen(false); setPasswordError(''); return true }

  const handleInputChange = e => {
    const { id, value, type, checked } = e.target
    if (id === 'password') setPasswordError('')
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
      if (!isCentralError(err)) setPasswordError(err.message ?? 'Ошибка загрузки аватара')
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
      if (!isCentralError(err)) setPasswordError(err.message ?? 'Ошибка удаления аватара')
    }
  }

  const handleSaveChanges = async onSuccess => {
    if (!editData || pending.current || !profileLoaded) return
    const age=editData.age===''?null:Number(editData.age)
    if(age!==null && (!Number.isInteger(age) || age<1 || age>120)) { setPasswordError('Укажите целый возраст от 1 до 120 лет или оставьте поле пустым'); return }
    pending.current=true; setSaving(true); setPasswordError('')
    let nameSaved=false, succeeded=false
    try {
      let updated=user
      if(editData.name!==user.name) {
        updated=await userApi.updateMe({name:editData.name})
        nameSaved=true
        const merged={...updated,avatarUrl:editData.avatarUrl}
        updateCurrentUser(merged);setUser(merged)
      }
      await questionnaireApi.profile({sex:editData.sex,age,trackCycle:editData.sex === 'FEMALE' && editData.trackCycle})
      emit(PROFILE_CHANGED)
      setOpen(false)
      succeeded=true
    } catch (err) {
      if (!isCentralError(err)) setPasswordError((nameSaved?'Имя сохранено. Данные для дневника не удалось сохранить: ':'')+(err.message ?? 'Ошибка сохранения'))
    } finally {
      pending.current=false;setSaving(false)
    }
    if(succeeded) onSuccess?.()
  }

  return {
    open, editData, tempAvatar, passwordError, saving, profileLoading, profileLoaded, loadProfile,
    openForm, closeForm,
    handleInputChange, handleAvatarUpload, handleAvatarDelete, handleSaveChanges,
  }
}
