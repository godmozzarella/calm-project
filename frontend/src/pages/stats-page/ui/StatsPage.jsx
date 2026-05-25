import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'

import { ChartSection } from '@/widgets/chart-section'
import { ArrowBackIcon, PrintIcon, FileDownloadIcon } from '@/shared/ui/icons'
import { getCurrentUser } from '@/entities/user'
import { attackApi, medicationApi, statsApi } from '@/shared/api'
import {
	subscribe,
	ATTACKS_CHANGED,
	MEDICATIONS_CHANGED,
} from '@/shared/lib/dataEvents'
import { useDictionaries } from '@/shared/lib/dictionaries'

import {
	exportAttacksCsv,
	exportMedicationsCsv,
	printDashboard,
	downloadPdf,
} from '../lib/export'

import s from './StatsPage.module.scss'

const todayLong = () => {
	const d = new Date()
	const months = [
		'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
		'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
	]
	return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

const StatsPage = () => {
	const [user, setUser]             = useState(null)
	const [attacks, setAttacks]       = useState([])
	const [medications, setMedications] = useState([])
	const [pdfLoading, setPdfLoading] = useState(false)
	const { symptoms, triggers }      = useDictionaries()

	const loadAttacks = useCallback(() => attackApi.getAll().then(setAttacks).catch(() => {}), [])
	const loadMeds    = useCallback(() => medicationApi.getAll().then(setMedications).catch(() => {}), [])

	useEffect(() => { setUser(getCurrentUser()) }, [])
	useEffect(() => { loadAttacks() }, [loadAttacks])
	useEffect(() => { loadMeds() },    [loadMeds])

	useEffect(() => subscribe(ATTACKS_CHANGED,     loadAttacks), [loadAttacks])
	useEffect(() => subscribe(MEDICATIONS_CHANGED, loadMeds),    [loadMeds])

	const hasData = attacks.length > 0 || medications.length > 0

	const handleExportAttacks = () => exportAttacksCsv(attacks, { symptoms, triggers })
	const handleExportMeds    = () => exportMedicationsCsv(medications)

	const buildReportArgs = async () => {
		const summary = await statsApi.getSummary('month').catch(() => ({}))
		return [
			{ attacks, medications, kpis: summary.kpis ?? null, patterns: summary.patterns ?? null, weather: summary.weather ?? null },
			{ name: user?.name, email: user?.email, date: todayLong(), symptoms, triggers },
		]
	}

	const handlePrint = async () => {
		if (pdfLoading) return
		setPdfLoading(true)
		try {
			const args = await buildReportArgs()
			printDashboard(...args)
		} finally {
			setPdfLoading(false)
		}
	}

	const handleDownloadPdf = async () => {
		if (pdfLoading) return
		setPdfLoading(true)
		try {
			const args = await buildReportArgs()
			await downloadPdf(...args)
		} finally {
			setPdfLoading(false)
		}
	}

	return (
		<div className={s.page}>
			{pdfLoading && (
				<div className={s.pdfOverlay}>
					<div className={s.pdfOverlaySpinner} />
					<span className={s.pdfOverlayText}>Генерируем PDF…</span>
				</div>
			)}

			<div className={s.topBar}>
				<Link to="/profile" className={s.backBtn} aria-label="К дневнику">
					<ArrowBackIcon fontSize="small" />
					<span>К дневнику</span>
				</Link>

				<div className={s.titleWrap}>
					<h1 className={s.title}>Статистика</h1>
					<span className={s.subtitle}>
						{user ? `${user.name} · ` : ''}отчёт на {todayLong()}
					</span>
				</div>

				<div className={s.actions}>
					<button
						className={s.actionBtn}
						onClick={handleDownloadPdf}
						disabled={!hasData || pdfLoading}
						title="Скачать отчёт в PDF"
					>
						<FileDownloadIcon style={{ fontSize: '1rem' }} />
						<span>{pdfLoading ? 'Генерируем...' : 'Скачать PDF'}</span>
					</button>
					<button
						className={s.actionBtn}
						onClick={handlePrint}
						disabled={!hasData}
						title="Распечатать отчёт"
					>
						<PrintIcon style={{ fontSize: '1rem' }} />
						<span>Печать</span>
					</button>
					<button
						className={s.actionBtn}
						onClick={handleExportAttacks}
						disabled={attacks.length === 0}
						title="Скачать CSV с приступами"
					>
						<FileDownloadIcon style={{ fontSize: '1rem' }} />
						<span>Приступы CSV</span>
					</button>
					<button
						className={s.actionBtn}
						onClick={handleExportMeds}
						disabled={medications.length === 0}
						title="Скачать CSV с препаратами"
					>
						<FileDownloadIcon style={{ fontSize: '1rem' }} />
						<span>Препараты CSV</span>
					</button>
				</div>
			</div>

			<div className={s.dashboard}>
				<ChartSection />
			</div>

			<p className={s.disclaimer}>
				Отчёт сформирован автоматически из дневника пользователя.
				Данные носят информационный характер и не являются медицинским заключением.
			</p>
		</div>
	)
}

export default StatsPage
