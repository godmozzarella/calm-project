/**
 * Экспорт данных: CSV, PDF и печать.
 * PDF и печать используют один HTML-шаблон (794px, белый фон, чёрный текст).
 */

import { ATTACK_TYPE_LABELS, PAIN_ZONE_LABELS } from '@/entities/attack'
import { EFFECTIVENESS_LABELS } from '@/entities/medication'

// ── CSV helpers ───────────────────────────────────────────────────────────────

const csvEscape = v => {
	if (v === null || v === undefined) return ''
	const str = String(v)
	if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`
	return str
}

const downloadBlob = (filename, content, mime = 'text/csv;charset=utf-8') => {
	const BOM = '﻿'
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

const labelsOfZones = pz => {
	if (!pz) return ''
	const zones = Array.isArray(pz) ? pz : Object.keys(pz)
	if (zones.length === 0) return ''
	return zones.map(z => PAIN_ZONE_LABELS[z] ?? z).join(', ')
}

// ── CSV exports ───────────────────────────────────────────────────────────────

export const exportAttacksCsv = (attacks, { symptoms = {}, triggers = {} } = {}) => {
	const labelsOf = (arr, dict) =>
		Array.isArray(arr) ? arr.map(v => dict[v] ?? v).join(', ') : ''

	const header = [
		'id', 'startDate', 'startTime', 'endDate', 'endTime',
		'ongoing', 'intensity', 'type', 'symptoms', 'triggers', 'painZones', 'note',
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
		labelsOf(a.symptoms, symptoms),
		labelsOf(a.triggers, triggers),
		labelsOfZones(a.painZones),
		a.note ?? '',
	])
	const csv = [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\n')
	downloadBlob(`calm-attacks-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

export const exportMedicationsCsv = medications => {
	const header = [
		'id', 'name', 'dosage', 'category', 'date', 'time', 'attackId', 'effectiveness', 'note',
	]
	const rows = medications.map(m => [
		m.id, m.name ?? '', m.dosage ?? '', m.category ?? '',
		m.date ?? '', m.time ?? '', m.attackId ?? '',
		m.effectiveness ?? '', m.note ?? '',
	])
	const csv = [header, ...rows].map(r => r.map(csvEscape).join(',')).join('\n')
	downloadBlob(`calm-medications-${new Date().toISOString().slice(0, 10)}.csv`, csv)
}

// ── SVG zone map generators ───────────────────────────────────────────────────

// Конвертация painZones из API в { zoneName: 'green'|'yellow'|'red' }
const toZoneMap = pz => {
	if (!pz || typeof pz !== 'object') return {}
	if (Array.isArray(pz)) return Object.fromEntries(pz.map(z => [z, 'red']))
	return pz
}

// Цвета зон для белого фона (пастельная заливка + насыщенная обводка)
const ZONE_COLORS = {
	green:  { fill: '#dcfce7', stroke: '#16a34a' },
	yellow: { fill: '#fef9c3', stroke: '#ca8a04' },
	red:    { fill: '#fee2e2', stroke: '#dc2626' },
	none:   { fill: '#f1f5f9', stroke: '#cbd5e1' },
}
const HEAD_FILL    = '#f0f4f8'
const HEAD_EAR    = '#e2e8f0'
const HEAD_STROKE = '#94a3b8'
const HEAD_FEAT   = '#94a3b8'

const zoneEll = (zone, zones, cx, cy, rx, ry) => {
	const color = zones[zone]
	const c = ZONE_COLORS[color] || ZONE_COLORS.none
	return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="${color ? '1.5' : '0.6'}"/>`
}

const headFrontSvg = (zones, uid) => {
	const HP = 'M80,16 C130,16 152,56 152,104 C152,160 126,208 80,212 C34,208 8,160 8,104 C8,56 30,16 80,16Z'
	const defs = [
		{ zone: 'crown',        cx: 80,  cy: 22,  rx: 64, ry: 50 },
		{ zone: 'forehead',     cx: 80,  cy: 74,  rx: 72, ry: 36 },
		{ zone: 'left_temple',  cx: 14,  cy: 112, rx: 60, ry: 50 },
		{ zone: 'right_temple', cx: 146, cy: 112, rx: 60, ry: 50 },
		{ zone: 'face',         cx: 80,  cy: 170, rx: 58, ry: 42 },
		{ zone: 'left_eye',     cx: 57,  cy: 112, rx: 26, ry: 18 },
		{ zone: 'right_eye',    cx: 103, cy: 112, rx: 26, ry: 18 },
	]
	return `<svg viewBox="0 0 160 228" xmlns="http://www.w3.org/2000/svg" width="80" height="114" style="display:block;">
		<defs><clipPath id="hf${uid}"><path d="${HP}"/></clipPath></defs>
		<ellipse cx="7"   cy="112" rx="9" ry="22" fill="${HEAD_EAR}" stroke="${HEAD_STROKE}" stroke-width="1"/>
		<ellipse cx="153" cy="112" rx="9" ry="22" fill="${HEAD_EAR}" stroke="${HEAD_STROKE}" stroke-width="1"/>
		<path d="${HP}" fill="${HEAD_FILL}" stroke="${HEAD_STROKE}" stroke-width="1.5"/>
		<g clip-path="url(#hf${uid})">${defs.map(d => zoneEll(d.zone, zones, d.cx, d.cy, d.rx, d.ry)).join('')}</g>
		<path d="M42,98 Q57,90 72,98"  fill="none" stroke="${HEAD_FEAT}" stroke-width="1.2" stroke-linecap="round"/>
		<path d="M88,98 Q103,90 118,98" fill="none" stroke="${HEAD_FEAT}" stroke-width="1.2" stroke-linecap="round"/>
		<path d="M63,170 Q80,181 97,170" fill="none" stroke="${HEAD_FEAT}" stroke-width="1.2" stroke-linecap="round"/>
	</svg>`
}

const headBackSvg = (zones, uid) => {
	const HP = 'M80,16 C132,16 154,58 154,106 C154,164 128,210 80,213 C32,210 6,164 6,106 C6,58 28,16 80,16Z'
	return `<svg viewBox="0 0 160 228" xmlns="http://www.w3.org/2000/svg" width="80" height="114" style="display:block;">
		<defs>
			<clipPath id="hb${uid}"><path d="${HP}"/></clipPath>
			<clipPath id="hbl${uid}"><rect x="0" y="0" width="80" height="228"/></clipPath>
			<clipPath id="hbr${uid}"><rect x="80" y="0" width="80" height="228"/></clipPath>
		</defs>
		<ellipse cx="5"   cy="112" rx="9" ry="22" fill="${HEAD_EAR}" stroke="${HEAD_STROKE}" stroke-width="1"/>
		<ellipse cx="155" cy="112" rx="9" ry="22" fill="${HEAD_EAR}" stroke="${HEAD_STROKE}" stroke-width="1"/>
		<path d="${HP}" fill="${HEAD_FILL}" stroke="${HEAD_STROKE}" stroke-width="1.5"/>
		<g clip-path="url(#hb${uid})">
			${zoneEll('crown',        zones, 80,  22,  66, 52)}
			<g clip-path="url(#hbl${uid})">${zoneEll('left_occiput',  zones, 36,  118, 66, 68)}</g>
			<g clip-path="url(#hbr${uid})">${zoneEll('right_occiput', zones, 124, 118, 66, 68)}</g>
			${zoneEll('neck',         zones, 80,  198, 50, 30)}
		</g>
		<path d="M58,198 Q80,205 102,198" fill="none" stroke="${HEAD_FEAT}" stroke-width="1" stroke-linecap="round"/>
	</svg>`
}

// ── PDF template helpers ──────────────────────────────────────────────────────

const C = {
	text:        '#111111',
	muted:       '#6b7280',
	accent:      '#2d5be3',
	accentLight: '#eef1ff',
	border:      '#e5e7eb',
	rowAlt:      '#f9fafb',
	white:       '#ffffff',
	amber:       '#b45309',
	red:         '#dc2626',
}

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
const fmtDate = iso => { if (!iso) return '—'; const p = iso.split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0].slice(2)}` : iso }
const fmtTime = t => (t ? String(t).slice(0, 5) : '—')
const labelOf = (val, dict) => (val != null ? (dict[val] ?? val) : '—')
const labelsOf = (arr, dict) => (!Array.isArray(arr) || !arr.length ? '—' : arr.map(v => dict[v] ?? v).join(', '))
const zonesOf = pz => { if (!pz) return '—'; const z = Array.isArray(pz) ? pz : Object.keys(pz); return z.length ? z.map(k => PAIN_ZONE_LABELS[k] ?? k).join(', ') : '—' }

const kpiTile = (value, label, color = C.text) => `
	<div style="flex:1;background:${C.rowAlt};border:1px solid ${C.border};border-radius:8px;padding:14px 10px;text-align:center;">
		<div style="font-size:24px;font-weight:700;color:${color};line-height:1.1;">${esc(String(value ?? '—'))}</div>
		<div style="font-size:9px;color:${C.muted};margin-top:5px;text-transform:uppercase;letter-spacing:0.06em;line-height:1.3;">${esc(label)}</div>
	</div>`

const section = title => `
	<div style="margin:26px 0 10px;font-size:10px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:0.08em;border-bottom:2px solid ${C.accentLight};padding-bottom:5px;">
		${esc(title)}
	</div>`

const th = (cells, widths = []) => `<tr style="background:${C.accentLight};">
	${cells.map((c, i) => `<th style="text-align:left;padding:7px 9px;font-size:9px;font-weight:700;color:${C.text};text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;${widths[i] ? `width:${widths[i]};` : ''}border-bottom:2px solid ${C.border};">${esc(c)}</th>`).join('')}
</tr>`

const tr = (cells, even) => `<tr style="background:${even ? C.rowAlt : C.white};">
	${cells.map(c => `<td style="padding:6px 9px;font-size:11px;color:${C.text};border-bottom:1px solid ${C.border};vertical-align:top;word-break:break-word;">${esc(c)}</td>`).join('')}
</tr>`

// ── Report HTML builder (shared by PDF and print) ─────────────────────────────

let _uidCounter = 0

const buildReportHtml = ({ attacks = [], medications = [], kpis, patterns, weather }, { name, email, date, symptoms = {}, triggers = {} }) => {
	_uidCounter = 0

	const sortByDate = (arr, field) => [...arr].sort((a, b) => (b[field] ?? '').localeCompare(a[field] ?? ''))
	const A = sortByDate(attacks, 'startDate').slice(0, 100)
	const M = sortByDate(medications, 'date').slice(0, 100)

	// ── KPI
	const kpiHtml = kpis ? `
		<div style="display:flex;gap:10px;">
			${kpiTile(kpis.total, 'Приступов', C.accent)}
			${kpiTile(kpis.avgIntensity != null ? Number(kpis.avgIntensity).toFixed(1) : '—', 'Ср. интенсивность')}
			${kpiTile(kpis.longestStreak ?? kpis.streak ?? '—', 'Макс. серия (дн.)')}
			${kpiTile(kpis.overuseDays ?? '—', 'Дни МОГ', kpis.overuseRisk ? C.red : C.text)}
		</div>` : ''

	// ── Patterns
	const topList = (items, dict) => (items ?? []).slice(0, 6).map((t, i) => `
		<div style="font-size:11px;color:${C.text};padding:4px 0;border-bottom:1px solid ${C.border};display:flex;justify-content:space-between;">
			<span><span style="color:${C.muted};margin-right:5px;">${i + 1}.</span>${esc(dict[t.value] ?? t.value)}</span>
			<span style="color:${C.muted};white-space:nowrap;margin-left:8px;">${t.count} дн.</span>
		</div>`).join('') || `<div style="font-size:11px;color:${C.muted};">—</div>`

	const patternsHtml = (patterns?.topTriggers?.length || patterns?.topSymptoms?.length) ? `
		<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
			<div>
				<div style="font-size:10px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Топ триггеры</div>
				${topList(patterns.topTriggers, triggers)}
			</div>
			<div>
				<div style="font-size:10px;font-weight:700;color:${C.muted};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Топ симптомы</div>
				${topList(patterns.topSymptoms, symptoms)}
			</div>
		</div>` : ''

	// ── Weather
	const weatherHtml = (weather?.daysCovered > 0) ? (() => {
		const riskHigher = weather.avgRiskOnAttackDays != null && weather.avgRiskOnPainFreeDays != null && weather.avgRiskOnAttackDays > weather.avgRiskOnPainFreeDays
		const pressLower = weather.avgPressureOnAttack != null && weather.avgPressureOnPainFree != null && weather.avgPressureOnAttack < weather.avgPressureOnPainFree
		return `
		<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
			${kpiTile(`${weather.attacksOnElevatedRisk}/${weather.attacksTotal}`, 'Приступов в дни риска')}
			${kpiTile(weather.avgRiskOnAttackDays ?? '—', 'Ср. риск в дни приступа', riskHigher ? C.amber : C.text)}
			${kpiTile(weather.avgRiskOnPainFreeDays ?? '—', 'Ср. риск без боли')}
			${kpiTile(weather.avgPressureOnAttack != null ? `${weather.avgPressureOnAttack} гПа` : '—', 'Давл. в дни приступа', pressLower ? C.amber : C.text)}
			${kpiTile(weather.avgPressureOnPainFree != null ? `${weather.avgPressureOnPainFree} гПа` : '—', 'Давл. без боли')}
		</div>
		<div style="font-size:10px;color:${C.muted};">Наблюдений: ${weather.daysCovered} дн.</div>`
	})() : ''

	// ── Zone maps
	const attacksWithZones = A.filter(a => {
		const pz = a.painZones
		if (!pz) return false
		return Array.isArray(pz) ? pz.length > 0 : Object.keys(pz).length > 0
	}).slice(0, 9)

	const zoneLegend = `
		<div style="display:flex;gap:14px;align-items:center;font-size:9px;color:${C.muted};margin-top:6px;">
			<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#16a34a;margin-right:3px;vertical-align:middle;"></span>Слабая</span>
			<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ca8a04;margin-right:3px;vertical-align:middle;"></span>Умеренная</span>
			<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#dc2626;margin-right:3px;vertical-align:middle;"></span>Сильная</span>
		</div>`

	const zoneMapsHtml = attacksWithZones.length > 0 ? `
		<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
			${attacksWithZones.map(a => {
				const uid = ++_uidCounter
				const zones = toZoneMap(a.painZones)
				const label = `${fmtDate(a.startDate ?? a.date)} ${fmtTime(a.startTime)} · ${a.intensity ?? '?'}/10`
				return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px;background:${C.rowAlt};border:1px solid ${C.border};border-radius:8px;">
					<div style="font-size:10px;color:${C.muted};text-align:center;">${esc(label)}</div>
					<div style="display:flex;gap:6px;align-items:flex-start;">
						<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
							${headFrontSvg(zones, uid * 2)}
							<span style="font-size:8px;color:${C.muted};">Спереди</span>
						</div>
						<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
							${headBackSvg(zones, uid * 2 + 1)}
							<span style="font-size:8px;color:${C.muted};">Сзади</span>
						</div>
					</div>
				</div>`
			}).join('')}
		</div>
		${zoneLegend}` : `<div style="font-size:12px;color:${C.muted};">Нет данных о зонах боли</div>`

	// ── Attacks table
	const attacksHtml = A.length > 0 ? `
		<table style="width:100%;border-collapse:collapse;">
			<thead>${th(['Дата', 'Начало', 'Конец', 'Инт.', 'Тип', 'Локализация', 'Триггеры', 'Симптомы'],
				['62px', '50px', '50px', '36px', '80px', '', '', ''])}</thead>
			<tbody>${A.map((a, i) => tr([
				fmtDate(a.startDate ?? a.date),
				fmtTime(a.startTime),
				a.ongoing ? 'текущий' : fmtTime(a.endTime),
				a.intensity ?? '—',
				labelOf(a.type, ATTACK_TYPE_LABELS),
				zonesOf(a.painZones),
				labelsOf(a.triggers, triggers),
				labelsOf(a.symptoms, symptoms),
			], i % 2 === 1)).join('')}</tbody>
		</table>
		${attacks.length > 100 ? `<div style="font-size:10px;color:${C.muted};margin-top:5px;">Показаны последние 100 из ${attacks.length} записей.</div>` : ''}`
		: `<div style="font-size:12px;color:${C.muted};">Нет данных</div>`

	// ── Medications table
	const medsHtml = M.length > 0 ? `
		<table style="width:100%;border-collapse:collapse;">
			<thead>${th(['Дата', 'Время', 'Препарат', 'Доза', 'Категория', 'Эффект'],
				['62px', '50px', '', '70px', '90px', '80px'])}</thead>
			<tbody>${M.map((m, i) => tr([
				fmtDate(m.date),
				fmtTime(m.time),
				m.name ?? '—',
				m.dosage ?? '—',
				m.category ?? '—',
				EFFECTIVENESS_LABELS[m.effectiveness] ?? '—',
			], i % 2 === 1)).join('')}</tbody>
		</table>
		${medications.length > 100 ? `<div style="font-size:10px;color:${C.muted};margin-top:5px;">Показаны последние 100 из ${medications.length} записей.</div>` : ''}`
		: `<div style="font-size:12px;color:${C.muted};">Нет данных</div>`

	const metaItems = [name, email].filter(Boolean)

	return `<div style="background:${C.white};font-family:Arial,Helvetica,sans-serif;width:794px;padding:44px 52px 48px;box-sizing:border-box;color:${C.text};">

		<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">
			<div>
				<div style="font-size:30px;font-weight:700;color:${C.accent};letter-spacing:-0.02em;line-height:1;">Calm</div>
				<div style="font-size:13px;color:${C.muted};margin-top:4px;">Отчёт о головной боли</div>
			</div>
			<div style="text-align:right;">
				<div style="font-size:12px;color:${C.muted};">${esc(date)}</div>
				${metaItems.map(p => `<div style="font-size:11px;color:${C.muted};margin-top:2px;">${esc(p)}</div>`).join('')}
			</div>
		</div>

		<div style="height:3px;background:${C.accentLight};border-radius:2px;margin-bottom:22px;"></div>

		${kpis ? section('Сводка (последний месяц)') + kpiHtml : ''}

		${patternsHtml ? section('Паттерны') + patternsHtml : ''}

		${weatherHtml ? section('Погода и приступы') + weatherHtml : ''}

		${section('Карты зон боли')}
		${zoneMapsHtml}

		${section(`Приступы${A.length > 0 ? ` · ${A.length}` : ''}`)}
		${attacksHtml}

		${section(`Препараты${M.length > 0 ? ` · ${M.length}` : ''}`)}
		${medsHtml}

		<div style="margin-top:32px;padding-top:12px;border-top:1px solid ${C.border};font-size:10px;color:${C.muted};line-height:1.5;">
			Отчёт сформирован автоматически из дневника пользователя приложения Calm.
			Данные носят информационный характер и не являются медицинским заключением.
		</div>
	</div>`
}

// ── Print (открывает шаблон в новом окне → диалог печати) ────────────────────

export const printDashboard = (data, meta) => {
	const html = buildReportHtml(data, meta)
	const win = window.open('', '_blank', 'width=900,height=700')
	if (!win) { alert('Разрешите всплывающие окна для печати'); return }
	win.document.write(`<!DOCTYPE html><html><head>
		<meta charset="utf-8">
		<title>Calm — Отчёт</title>
		<style>@page{margin:8mm;size:A4 portrait}body{margin:0;}</style>
	</head><body>${html}</body></html>`)
	win.document.close()
	setTimeout(() => { win.focus(); win.print() }, 400)
}

// ── PDF download ──────────────────────────────────────────────────────────────

export const downloadPdf = async (data, meta) => {
	const [{ jsPDF }, html2canvas] = await Promise.all([
		import('jspdf'),
		import('html2canvas').then(m => m.default),
	])

	const html = buildReportHtml(data, meta)
	const el = document.createElement('div')
	el.innerHTML = html
	Object.assign(el.style, {
		position: 'absolute',
		top: '0',
		left: '-9999px',
		width: '794px',
	})
	document.body.appendChild(el)

	try {
		const canvas = await html2canvas(el, {
			scale: 2,
			useCORS: true,
			logging: false,
			backgroundColor: '#ffffff',
		})

		const imgData = canvas.toDataURL('image/png')
		const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
		const pageW = 210
		const pageH = 297
		const totalImgH = (canvas.height / canvas.width) * pageW

		pdf.addImage(imgData, 'PNG', 0, 0, pageW, totalImgH, '', 'FAST')
		let heightLeft = totalImgH - pageH
		let shift = 0
		while (heightLeft > 0) {
			pdf.addPage()
			shift -= pageH
			pdf.addImage(imgData, 'PNG', 0, shift, pageW, totalImgH, '', 'FAST')
			heightLeft -= pageH
		}

		pdf.save(`calm-report-${new Date().toISOString().slice(0, 10)}.pdf`)
	} finally {
		document.body.removeChild(el)
	}
}
