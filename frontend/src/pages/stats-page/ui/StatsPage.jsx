import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'

import { ChartSection } from '@/widgets/chart-section'
import { ArrowBackIcon, PrintIcon, FileDownloadIcon } from '@/shared/ui/icons'
import { getCurrentUser } from '@/entities/user'
import { attackApi, medicationApi } from '@/shared/api'
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
	const dashboardRef                = useRef(null)
	const { symptoms, triggers }      = useDictionaries()

	const loadAttacks = useCallback(() => attackApi.getAll().then(setAttacks).catch(() => {}), [])
	const loadMeds    = useCallback(() => medicationApi.getAll().then(setMedications).catch(() => {}), [])

	useEffect(() => { setUser(getCurrentUser()) }, [])
	useEffect(() => { loadAttacks() }, [loadAttacks])
	useEffect(() => { loadMeds() },    [loadMeds])

	useEffect(() => subscribe(ATTACKS_CHANGED,     loadAttacks), [loadAttacks])
	useEffect(() => subscribe(MEDICATIONS_CHANGED, loadMeds),    [loadMeds])

	const hasData = attacks.length > 0 || medications.length > 0

	const handlePrint = () => printDashboard()
	const handleExportAttacks = () => exportAttacksCsv(attacks, { symptoms, triggers })
	const handleExportMeds    = () => exportMedicationsCsv(medications)
	const handleDownloadPdf   = async () => {
		if (!dashboardRef.current || pdfLoading) return
		setPdfLoading(true)
		try {
			await downloadPdf(dashboardRef.current, {
				name:  user?.name,
				email: user?.email,
				date:  todayLong(),
			})
		} finally {
			setPdfLoading(false)
		}
	}

	return (
		<div className={s.page}>
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

			<div className={s.printOnly}>
				<h1 className={s.printTitle}>Calm — отчёт о головной боли</h1>
				<p className={s.printMeta}>
					{user ? `Пациент: ${user.name}` : ''}
					{user?.email ? ` · ${user.email}` : ''}
					{` · сформировано ${todayLong()}`}
				</p>
			</div>

			<div className={s.dashboard} ref={dashboardRef}>
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
