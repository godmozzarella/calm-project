import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ChartSection } from '@/widgets/chart-section'
import { ArrowBackIcon, PrintIcon, FileDownloadIcon } from '@/shared/ui/icons'
import { getCurrentUser } from '@/entities/user'
import { getAllAttacks } from '@/entities/attack'
import { getAllMedications } from '@/entities/medication'
import {
	subscribe,
	ATTACKS_CHANGED,
	MEDICATIONS_CHANGED,
} from '@/shared/lib/dataEvents'

import {
	exportAttacksCsv,
	exportMedicationsCsv,
	printDashboard,
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
	const [user, setUser] = useState(null)
	const [attackCount, setAttackCount] = useState(() => getAllAttacks().length)
	const [medCount, setMedCount] = useState(() => getAllMedications().length)

	useEffect(() => {
		setUser(getCurrentUser())
	}, [])

	useEffect(() => subscribe(ATTACKS_CHANGED, () => setAttackCount(getAllAttacks().length)), [])
	useEffect(() => subscribe(MEDICATIONS_CHANGED, () => setMedCount(getAllMedications().length)), [])

	const hasData = attackCount > 0 || medCount > 0

	const handlePrint = () => printDashboard()
	const handleExportAttacks = () => exportAttacksCsv(getAllAttacks())
	const handleExportMeds = () => exportMedicationsCsv(getAllMedications())

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
						onClick={handlePrint}
						disabled={!hasData}
						title="Сохранить отчёт в PDF через печать"
					>
						<PrintIcon style={{ fontSize: '1rem' }} />
						<span>PDF</span>
					</button>
					<button
						className={s.actionBtn}
						onClick={handleExportAttacks}
						disabled={attackCount === 0}
						title="Скачать CSV с приступами"
					>
						<FileDownloadIcon style={{ fontSize: '1rem' }} />
						<span>Приступы CSV</span>
					</button>
					<button
						className={s.actionBtn}
						onClick={handleExportMeds}
						disabled={medCount === 0}
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
