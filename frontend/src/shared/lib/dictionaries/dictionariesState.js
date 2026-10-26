import { createContext, useContext } from 'react'

export const DictionariesContext = createContext({
	symptoms: {},
	triggers: {},
	medications: [],
	getLabel: (_type, value) => value,
	refresh: () => {},
})

export const useDictionaries = () => useContext(DictionariesContext)
