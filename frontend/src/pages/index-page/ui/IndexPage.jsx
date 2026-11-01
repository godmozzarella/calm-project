import { useEffect, useRef} from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '@/widgets/header'
import { Footer } from '@/widgets/footer'
import { AuthForm } from '@/features/auth'
import BlueOrb from '@/shared/ui/BlueOrb/BlueOrb'
import { Button } from '@/shared/ui/Button'
import { Section } from '@/shared/ui/Section'
import { SectionBlock } from '@/shared/ui/SectionBlock'
import HowToCarousel from './HowToCarousel'
import {
	ArrowForwardIcon,
	AnalyticsIcon,
	MedicationIcon,
	MedicalInformationIcon,
	PersonIcon
} from '@/shared/ui/icons'
import s from './IndexPage.module.scss'

const IndexPage = () => {
	const protectionRef = useRef(null)
	const navigate = useNavigate()

	useEffect(() => {
		const section = protectionRef.current
		if (!section) return
		let frame = 0
		const updateReveal = () => {
			frame = 0
			const rect = section.getBoundingClientRect()
			const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))
			const visibleRatio = visibleHeight / rect.height
			const revealProgress = Math.max(0, Math.min(1, visibleRatio / 0.8))
			const progress = revealProgress * revealProgress * (3 - 2 * revealProgress)
			section.style.setProperty('--protection-blur', `${((1 - progress) * 9).toFixed(2)}px`)
		}
		const scheduleRevealUpdate = () => {
			if (!frame) frame = window.requestAnimationFrame(updateReveal)
		}
		updateReveal()
		window.addEventListener('scroll', scheduleRevealUpdate, { passive: true })
		window.addEventListener('resize', scheduleRevealUpdate)
		return () => {
			window.removeEventListener('scroll', scheduleRevealUpdate)
			window.removeEventListener('resize', scheduleRevealUpdate)
			if (frame) window.cancelAnimationFrame(frame)
		}
	}, [])

	return (
		<div className={s.indexBody} data-disable-help-tooltip>
			<div className={s.ambientLayer} aria-hidden="true">
				<BlueOrb className={s.ambientOrbOne} />
				<BlueOrb className={s.ambientOrbTwo} />
				<BlueOrb className={s.ambientOrbThree} />
				<BlueOrb className={s.ambientOrbFour} />
				<BlueOrb className={s.ambientOrbFive} />
			</div>
			<Header />

			<div className={s.heroGlowArea}>
				<BlueOrb className={s.logoOrb} />
				<Section colored>
					<div className={s.rowContent}>
						<div className={s.containerItem}>
							<h1>Отслеживай. Понимай. Живи легче!</h1>
							<p className={s.description}>
								Мы рядом, чтобы помочь тебе разобраться с головной болью и сделать
								каждый день немного легче.
							</p>
						</div>
						<div className={s.containerItem}>
							<div className={s.logoStage}>
								<p className={s.bigLogo}>Calm</p>
							</div>
						</div>
					</div>
				</Section>
			</div>

			<Section
				id="for_who"
				className={s.forWhoSection}
				blocksClassName={s.forWhoBlocks}
				title={
					<>
						Для кого <span className={s.inTextLogo}>Calm</span>?
					</>
				}
			>
				<SectionBlock
					icon={<PersonIcon />}
					title="Для тех, кто хочет разобраться в приступах"
					description="Отмечай интенсивность, длительность, симптомы, возможные триггеры и зоны боли — история каждого приступа останется в дневнике."
				/>
				<SectionBlock
					icon={<MedicationIcon />}
					title="Для тех, кто отслеживает приём препаратов"
					description="Записывай дозировку и отмечай, насколько помог препарат, чтобы сравнивать свои наблюдения в дневнике и статистике."
				/>
				<SectionBlock
					icon={<AnalyticsIcon />}
					title="Для тех, кто хочет видеть динамику"
					description="Календарь, статистика и серии дней без приступа помогают наблюдать, как меняется головная боль со временем."
				/>
				<SectionBlock
					icon={<MedicalInformationIcon />}
					title="Для подготовки к визиту к врачу"
					description="Сформируй отчёт из записей дневника и покажи его специалисту. Calm помогает подготовить наблюдения, но не ставит диагноз."
				/>
			</Section>

			<HowToCarousel />

			<section id="data-protection" ref={protectionRef} className={s.protectionSection}>
				<div className={s.protectionContent}>
					<h2 className={s.protectionTitle}>Ваши данные —<br />под защитой</h2>
					<p className={s.protectionSlogan}>Ваше доверие — наша ответственность.</p>
					<div className={s.protectionCopy}>
						<p className={s.protectionDescription}>Вы доверяете нам личную информацию, поэтому мы открыто рассказываем, как устроена наша политика безопасности и использования данных.</p>
						<Button type="button" colored icon={<ArrowForwardIcon fontSize="small" />} className={s.protectionButton} onClick={() => navigate('/privacy-policy')}>
							Узнать больше
						</Button>
					</div>
				</div>
			</section>

			<div className={s.bottomGlowArea}>
				<BlueOrb className={s.bottomOrb} />
				<Section
					id="regAndLog"
					title={
						<>
							Используй <span className={s.inTextLogo}>Calm</span> прямо сейчас!
						</>
					}
					colored
				>
					<AuthForm />
				</Section>

				<Footer />
			</div>
		</div>
	)
}

export default IndexPage
