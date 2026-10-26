import { useEffect, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { ChartSection } from '@/widgets/chart-section'
import { BackIcon, PrintIcon, FileDownloadIcon } from '@/shared/ui/icons'
import { getCurrentUser } from '@/entities/user'
import { attackApi, medicationApi, riskApi, statsApi } from '@/shared/api'
import {
	subscribe,
	ATTACKS_CHANGED,
	MEDICATIONS_CHANGED,
} from '@/shared/lib/dataEvents'
import { useDictionaries } from '@/shared/lib/dictionaries'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import PageLoading from '@/shared/ui/PageLoading/PageLoading'

import {
	exportAttacksCsv,
	exportMedicationsCsv,
	printDashboard,
	downloadPdf,
} from '../lib/export'

import s from './StatsPage.module.scss'
import RiskQualityBlock from './RiskQualityBlock'

const todayLong = () => {
	const d = new Date()
	const months = [
		'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
		'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
	]
	return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

const StatsPage = () => {
	const location = useLocation()
	const navigate = useNavigate()
	const [user]                      = useState(getCurrentUser)
	const [attacks, setAttacks]       = useState([])
	const [medications, setMedications] = useState([])
	const [readyParts, setReadyParts] = useState({})
	const [showBeforeReady, setShowBeforeReady] = useState(false)
	const [pdfLoading, setPdfLoading] = useState(false)
	const [riskQuality, setRiskQuality] = useState(null)
	const [riskQualityError, setRiskQualityError] = useState(null)
	const { symptoms, triggers }      = useDictionaries()
	const markReady = useCallback(part => setReadyParts(previous =>
		previous[part] ? previous : { ...previous, [part]: true }), [])
	const statsReady = ['attacks', 'medications', 'quality', 'chart']
		.every(part => readyParts[part])
	const statsVisible = statsReady || showBeforeReady
	useBodyScrollLock(!statsVisible)

	const loadAttacks = useCallback(() => attackApi.getAll().then(setAttacks).catch(() => {}), [])
	const loadMeds    = useCallback(() => medicationApi.getAll().then(setMedications).catch(() => {}), [])

	useEffect(() => {
		let active = true
		loadAttacks().then(() => { if (active) markReady('attacks') })
		return () => { active = false }
	}, [loadAttacks, markReady])
	useEffect(() => {
		let active = true
		loadMeds().then(() => { if (active) markReady('medications') })
		return () => { active = false }
	}, [loadMeds, markReady])
	useEffect(() => {
		let active = true
		riskApi.getQuality()
			.then(data => { if (active) setRiskQuality(data) })
			.catch(e => { if (active) setRiskQualityError(e.message) })
			.finally(() => { if (active) markReady('quality') })
		return () => { active = false }
	}, [markReady])

	useEffect(() => subscribe(ATTACKS_CHANGED,     loadAttacks), [loadAttacks])
	useEffect(() => subscribe(MEDICATIONS_CHANGED, loadMeds),    [loadMeds])

	const hasData = attacks.length > 0 || medications.length > 0

	const handleExportAttacks = () => exportAttacksCsv(attacks, { symptoms, triggers })
	const handleExportMeds    = () => exportMedicationsCsv(medications)
	const handleBack = () => {
		if (location.state?.from === 'menu') {
			navigate('/profile', { replace: true, state: { openMenu: true } })
		} else if (location.state?.from === 'diary') {
			navigate('/profile', { replace: true, state: { scrollToChart: true } })
		} else {
			navigate('/profile', { replace: true })
		}
	}

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
			{!statsVisible && <PageLoading label="Загружаем статистику…" onContinue={() => setShowBeforeReady(true)} />}
			{pdfLoading && (
				<div className={s.pdfOverlay}>
					<div className={s.pdfOverlaySpinner} />
					<span className={s.pdfOverlayText}>Генерируем PDF…</span>
				</div>
			)}

			<div className={s.topBar}>
				<button type="button" onClick={handleBack} className={s.backBtn} aria-label="Назад" title="Назад">
					<BackIcon fontSize="small" />
				</button>

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
				<ChartSection onInitialReady={markReady} />
				<RiskQualityBlock quality={riskQuality} error={riskQualityError} />
			</div>

			<p className={s.disclaimer}>
				Отчёт сформирован автоматически из дневника пользователя.
				Данные носят информационный характер и не являются медицинским заключением.
			</p>
		</div>
	)
}

export default StatsPage
