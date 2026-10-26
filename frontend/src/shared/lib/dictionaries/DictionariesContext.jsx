import { useCallback, useEffect, useRef, useState } from 'react'

import { dictionaryApi } from '@/shared/api'
import { getToken } from '@/shared/api'
import { subscribe, AUTH_CHANGED } from '@/shared/lib/dataEvents'
import { DictionariesContext } from './dictionariesState'

const toMap = list => Object.fromEntries(list.map(e => [e.value, e.label]))

export const DictionariesProvider = ({ children }) => {
	const [symptoms, setSymptoms] = useState({})
	const [triggers, setTriggers] = useState({})
	const [medications, setMedications] = useState([]) // полные записи, не мап — нужен category
	const loadId = useRef(0)

	const load = useCallback(() => {
		const currentLoad = ++loadId.current
		if (!getToken()) {
			setSymptoms({})
			setTriggers({})
			setMedications([])
			return
		}
		const stillCurrent = () => loadId.current === currentLoad
		dictionaryApi.getByType('SYMPTOM').then(list => { if (stillCurrent()) setSymptoms(toMap(list)) }).catch(() => {})
		dictionaryApi.getByType('TRIGGER').then(list => { if (stillCurrent()) setTriggers(toMap(list)) }).catch(() => {})
		dictionaryApi.getByType('MEDICATION_PRESET').then(list => { if (stillCurrent()) setMedications(list) }).catch(() => {})
	}, [])

	useEffect(() => { load() }, [load])

	// Когда админ меняет словарь в этой же вкладке — перезагружаем.
	useEffect(() => subscribe('calm:dictionaries-changed', load), [load])
	useEffect(() => subscribe(AUTH_CHANGED, load), [load])

	const getLabel = useCallback((type, value) => {
		if (!value) return value
		const map = type === 'SYMPTOM' ? symptoms : type === 'TRIGGER' ? triggers : null
		return map?.[value] ?? value
	}, [symptoms, triggers])

	return (
		<DictionariesContext.Provider value={{ symptoms, triggers, medications, getLabel, refresh: load }}>
			{children}
		</DictionariesContext.Provider>
	)
}
