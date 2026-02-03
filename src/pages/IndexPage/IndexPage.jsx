
import Footer from '../../components/Footer/Footer'
import Header from '../../components/Header/Header'
import Section from '../../components/IndexSection/IndexSection'
import SectionBlock from '../../components/IndexSectionBlock/IndexSectionBlock'
import Button from '../../components/Button/Button'
import AddUser from '../../components/AddUser/AddUser'

import s from './IndexPage.module.scss'

import {
	AnalyticsIcon,
	CalendarMonthIcon,
	CircleIcon,
	ConnectIcon,
	ForwardToInboxIcon,
	InstallDesktopIcon,
	InstallMobileIcon,
	MedicalInformationIcon,
	PersonIcon,
	SecurityIcon
} from '../../assets/icons'

function IndexPage() {
	return (
		<div className={s.indexBody}>
			<Header />
			<Section
				colored
				children={
					<div className={s.rowContent}>
						<div className={s.containerItem}>
							<h1>Отслеживай. Понимай. Живи легче!</h1>
							<p className={s.description}>
								Мы рядом, чтобы помочь тебе разобраться с головной болью и
								сделать каждый день немного легче.
							</p>
						</div>
						<div className={s.containerItem}>
							<p className={s.bigLogo}>Calm</p>
							<div className={s.buttons}>
								<Button 
								colored
								children={<p className={s.buttonText}>Для вашего телефона</p>}
								icon={<InstallMobileIcon />}
								/>

								<Button 
								colored
								children={<p className={s.buttonText}>Для вашего компьютера</p>}
								icon={<InstallDesktopIcon />}
								/>
							</div>
						</div>
					</div>
				}
			/>

			<Section
				id="for_who"
				title={
					<>
						Для кого <span className={s.inTextLogo}>Calm</span>?
					</>
				}
				children={
					<>
						<SectionBlock
							icon={<PersonIcon />}
							title={<>Для тех, кто часто страдает от головной боли</>}
							description={
								<>
									Отмечай приступы и их интенсивность, чтобы понять, что
									провоцирует боль, и снизить её влияние на повседневную жизнь.
								</>
							}
						/>
						<SectionBlock
							icon={<CalendarMonthIcon />}
							title={<>Для заботящихся о своём здоровье</>}
							description={
								<>
									Веди персональный дневник самочувствия и замечай
									закономерности, которые помогут принимать правильные решения
									каждый день.
								</>
							}
						/>
						<SectionBlock
							icon={<ForwardToInboxIcon />}
							title={<>Для тех, кто хочет делиться данными с врачом</>}
							description={
								<>
									Собирай подробную информацию о симптомах и триггерах — это
									поможет врачу назначить более точное лечение.
								</>
							}
						/>
						<SectionBlock
							icon={<MedicalInformationIcon />}
							title={<>Для врачей и специалистов</>}
							description={
								<>
									Создайте профиль, подключайте своих пациентов и получайте
									наглядную статистику по их головной боли. Лёгкий способ
									отслеживать симптомы, триггеры и эффективность лечения каждого
									пациента.
								</>
							}
						/>
					</>
				}
			/>

			<Section
				id="about"
				title="О нас"
				colored
				children={
					<>
						<SectionBlock
							colored
							title={<>Наша цель</>}
							description={
								<>
									Наша цель — помочь людям лучше понимать свою головную боль,
									отслеживать симптомы и улучшать качество жизни с помощью
									персонального подхода и технологий.
								</>
							}
						/>
						<SectionBlock
							colored
							title={<>Что мы предлагаем</>}
							description={
								<>
									Мы объединяем удобный дневник, умный анализ данных и
									возможность подключить врача, чтобы каждый день был легче и
									безопаснее.
								</>
							}
						/>
						<SectionBlock
							colored
							title={<>Команда</>}
							description={
								<>
									Наша команда — это разработчики, врачи и исследователи,
									объединённые одной целью: помочь людям справляться с головной
									болью осознанно и эффективно.
								</>
							}
						/>
						<SectionBlock
							colored
							title={<>Почему нам можно доверять</>}
							description={
								<>
									Все данные надежно защищены и используются только для
									улучшения вашего здоровья. Мы стремимся сделать отслеживание
									головной боли простым, безопасным и полезным.
								</>
							}
						/>
					</>
				}
			/>

			<Section
				id="benefits"
				title={
					<>
						Почему именно <span className={s.inTextLogo}>Calm</span>?
					</>
				}
				children={
					<>
						<SectionBlock
							icon={<CircleIcon />}
							title={<>Простота и удобство</>}
							description={
								<>
									Легкий в использовании интерфейс, быстрый ввод данных и
									наглядная визуализация позволяют отслеживать состояние без
									лишнего стресса.
								</>
							}
						/>
						<SectionBlock
							icon={<SecurityIcon />}
							title={<>Безопасность и конфиденциальность</>}
							description={
								<>
									Все данные защищены и доступны только вам и вашему врачу. Ваше
									здоровье — под надежной защитой.
								</>
							}
						/>
						<SectionBlock
							icon={<ConnectIcon />}
							title={<>Возможность подключения врача</>}
							description={
								<>
									Пациенты могут делиться данными напрямую с врачом, а
									специалисты получают удобную аналитику по всем подключённым
									пациентам.
								</>
							}
						/>
						<SectionBlock
							icon={<AnalyticsIcon />}
							title={<>Умный анализ данных</>}
							description={
								<>
									Автоматический сбор и обработка симптомов, триггеров и
									интенсивности приступов помогает видеть закономерности и
									предсказывать возможные эпизоды.
								</>
							}
						/>
					</>
				}
			/>

			<Section
				id="regAndLog"
				title={
					<>
						Используй <span className={s.inTextLogo}>Calm</span> прямо сейчас!
					</>
				}
				colored
				children={
					<>
						<AddUser />
					</>
				}
			/>
			<Footer />
		</div>
	)
}

export default IndexPage
