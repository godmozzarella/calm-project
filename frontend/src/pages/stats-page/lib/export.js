/**
 * Экспорт сырых данных в CSV. PDF делается через window.print + print-стили.
 */

import {
	ATTACK_TYPE_LABELS,
	SYMPTOM_LABELS,
	TRIGGER_LABELS,
	PAIN_ZONE_LABELS,
} from '@/entities/attack'

const csvEscape = v => {
	if (v === null || v === undefined) return ''
	const str = String(v)
	if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`
	return str
}

const downloadBlob = (filename, content, mime = 'text/csv;charset=utf-8') => {
	const BOM = '﻿' // чтобы Excel корректно прочитал кириллицу
	const blob = new Blob([BOM + content], { type: mime })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	URL.revokeObjectURL(url)
}

const labelsOfArray = (arr, dict) => {
	if (!Array.isArray(arr) || arr.length === 0) return ''
	return arr.map(v => dict[v] ?? v).join(', ')
}

const labelsOfZones = pz => {
	if (!pz) return ''
	const zones = Array.isArray(pz) ? pz : Object.keys(pz)
	if (zones.length === 0) return ''
	return zones.map(z => PAIN_ZONE_LABELS[z] ?? z).join(', ')
}

export const exportAttacksCsv = (attacks) => {
	const header = [
		'id',
		'startDate',
		'startTime',
		'endDate',
		'endTime',
		'ongoing',
		'intensity',
		'type',
		'symptoms',
		'triggers',
		'painZones',
		'note',
	]
	const rows = attacks.map(a => [
		a.id,
		a.startDate ?? a.date ?? '',
		a.startTime ?? '',
		a.endDate ?? '',
		a.endTime ?? '',
		a.ongoing ? 'да' : 'нет',
		a.intensity ?? '',
		ATTACK_TYPE_LABELS[a.type] ?? a.type ?? '',
		labelsOfArray(a.symptoms, SYMPTOM_LABELS),
		labelsOfArray(a.triggers, TRIGGER_LABELS),
		labelsOfZones(a.painZones),
		a.note ?? '',
	])
	const csv = [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\n')
	downloadBlob(`calm-attacks-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

export const exportMedicationsCsv = (medications) => {
	const header = [
		'id',
		'name',
		'dosage',
		'category',
		'date',
		'time',
		'attackId',
		'effectiveness',
		'note',
	]
	const rows = medications.map(m => [
		m.id,
		m.name ?? '',
		m.dosage ?? '',
		m.category ?? '',
		m.date ?? '',
		m.time ?? '',
		m.attackId ?? '',
		m.effectiveness ?? '',
		m.note ?? '',
	])
	const csv = [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\n')
	downloadBlob(`calm-medications-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

export const printDashboard = () => {
	window.print()
}
