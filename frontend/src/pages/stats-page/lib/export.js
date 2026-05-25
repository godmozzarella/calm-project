/**
 * Экспорт данных: CSV и PDF (jsPDF + html2canvas).
 */

import {
	ATTACK_TYPE_LABELS,
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

export const exportAttacksCsv = (attacks, { symptoms = {}, triggers = {} } = {}) => {
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
		labelsOfArray(a.symptoms, symptoms),
		labelsOfArray(a.triggers, triggers),
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

export const downloadPdf = async (dashboardEl, { name, email, date }) => {
	const [{ jsPDF }, html2canvas] = await Promise.all([
		import('jspdf'),
		import('html2canvas').then(m => m.default),
	])

	// Вставляем заголовок как HTML — браузер рендерит кириллицу корректно,
	// html2canvas захватит его как пиксели (нет проблем с отсутствием шрифтов в jsPDF).
	const header = document.createElement('div')
	header.style.cssText = [
		'padding: 0 0 1rem 0',
		'font-family: inherit',
		'color: #e0e6f0',
	].join(';')

	const metaParts = []
	if (name) metaParts.push(`Пациент: ${name}`)
	if (email) metaParts.push(email)
	metaParts.push(`Сформировано: ${date}`)

	header.innerHTML = `
		<div style="font-size:20px;font-weight:600;margin-bottom:6px;">Calm — отчёт о головной боли</div>
		<div style="font-size:12px;color:rgba(140,150,170,0.85);">${metaParts.join(' · ')}</div>
		<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin-top:12px;">
	`
	dashboardEl.prepend(header)

	try {
		const canvas = await html2canvas(dashboardEl, {
			scale: 2,
			useCORS: true,
			logging: false,
		})

		const imgData = canvas.toDataURL('image/png')
		const pdf = new jsPDF({ unit: 'mm', format: 'a4' })

		const pageW = pdf.internal.pageSize.getWidth()
		const pageH = pdf.internal.pageSize.getHeight()
		const margin = 10
		const contentW = pageW - margin * 2
		const totalImgH = (canvas.height / canvas.width) * contentW

		pdf.addImage(imgData, 'PNG', margin, margin, contentW, totalImgH, '', 'FAST')

		let heightLeft = totalImgH - (pageH - margin * 2)
		let shift = margin

		while (heightLeft > 0) {
			pdf.addPage()
			shift -= pageH
			pdf.addImage(imgData, 'PNG', margin, shift + margin, contentW, totalImgH, '', 'FAST')
			heightLeft -= pageH
		}

		pdf.save(`calm-report-${new Date().toISOString().slice(0, 10)}.pdf`)
	} finally {
		dashboardEl.removeChild(header)
	}
}
