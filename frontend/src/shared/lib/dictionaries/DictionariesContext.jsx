import { createContext, useCallback, useContext, useEffect, useState } from 'react'

import { dictionaryApi } from '@/shared/api'
import { getToken } from '@/shared/api'
import { subscribe } from '@/shared/lib/dataEvents'

const Ctx = createContext({
	symptoms: {},
	triggers: {},
	medications: [],
	getLabel: (_type, value) => value,
	refresh: () => {},
})

const toMap = list => Object.fromEntries(list.map(e => [e.value, e.label]))

export const DictionariesProvider = ({ children }) => {
	const [symptoms, setSymptoms] = useState({})
	const [triggers, setTriggers] = useState({})
	const [medications, setMedications] = useState([]) // полные записи, не мап — нужен category

	const load = useCallback(() => {
		if (!getToken()) return // справочники под аутентификацией; на лендинге не дёргаем
		dictionaryApi.getByType('SYMPTOM').then(list => setSymptoms(toMap(list))).catch(() => {})
		dictionaryApi.getByType('TRIGGER').then(list => setTriggers(toMap(list))).catch(() => {})
		dictionaryApi.getByType('MEDICATION_PRESET').then(setMedications).catch(() => {})
	}, [])

	useEffect(() => { load() }, [load])

	// Когда админ меняет словарь в этой же вкладке — перезагружаем.
	useEffect(() => subscribe('calm:dictionaries-changed', load), [load])

	const getLabel = useCallback((type, value) => {
		if (!value) return value
		const map = type === 'SYMPTOM' ? symptoms : type === 'TRIGGER' ? triggers : null
		return map?.[value] ?? value
	}, [symptoms, triggers])

	return (
		<Ctx.Provider value={{ symptoms, triggers, medications, getLabel, refresh: load }}>
			{children}
		</Ctx.Provider>
	)
}

export const useDictionaries = () => useContext(Ctx)
