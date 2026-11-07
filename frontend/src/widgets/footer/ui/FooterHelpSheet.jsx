import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '@/shared/ui/icons'
import s from './FooterHelpSheet.module.scss'

const guides = {
	'install-ios': {
		title: 'Calm на экране «Домой»',
		disclaimer: false,
		sections: [
			['1. Откройте Calm в Safari', 'Если сайт открыт внутри Telegram или другого приложения, сначала откройте его в Safari.'],
			['2. Откройте меню «Поделиться»', 'Нажмите значок квадрата со стрелкой вверх. В некоторых версиях Safari он находится в меню «Ещё».'],
			['3. Добавьте на экран «Домой»', 'Выберите «На экран Домой» или «Добавить на экран Домой». Если есть переключатель «Открывать как веб-приложение», включите его, затем нажмите «Добавить».'],
			['Готово', 'На экране телефона появится иконка Calm. Она открывает сайт; для работы с дневником нужен интернет.'],
		],
	},
	'install-android': {
		title: 'Установка Calm на Android',
		disclaimer: false,
		sections: [
			['1. Откройте Calm в браузере', 'Подойдёт Chrome или другой браузер с поддержкой установки сайтов. Если вы пришли из мессенджера, выберите «Открыть в браузере».'],
			['2. Добавьте иконку', 'Откройте меню браузера ⋮ и выберите «Установить приложение» или «Добавить на главный экран». Название зависит от браузера. Подтвердите добавление.'],
			['Если пункта установки нет', 'Попробуйте открыть Calm в Chrome. Если в меню есть только «Добавить на главный экран», выберите этот пункт — он создаст иконку для быстрого открытия сайта.'],
			['Готово', 'Иконка Calm будет открывать сайт. Для работы с дневником нужен интернет.'],
		],
	},
	'install-other': {
		title: 'Установить Calm',
		disclaimer: false,
		sections: [
			['На iPhone', 'Откройте сайт в Safari > «Поделиться» > «На экран Домой» > «Добавить».'],
			['На Android', 'В меню браузера выберите «Установить приложение» или «Добавить на главный экран».'],
			['На компьютере', 'Откройте меню браузера и найдите пункт «Установить Calm» или «Установить приложение». Если такого пункта нет, попробуйте Chrome или Edge.'],
			['Как это работает', 'Иконка открывает Calm с экрана устройства. Дневник работает через интернет.'],
		],
	},
	faq: {
		title: 'Частые вопросы',
		sections: [
			['Для чего нужен Calm?', 'Calm помогает вести дневник головной боли, замечать изменения и подготовить записи для обсуждения с врачом.'],
			['Как отметить отсутствие новых приступов?', 'Выберите день и включите отметку «Новых приступов не было». Продолжающийся старый приступ не мешает отметке. Если добавите новое начало за этот день, отметка отменится.'],
			['Оценка риска — это диагноз?', 'Нет. Это ориентир приложения, который не заменяет медицинскую оценку и консультацию специалиста.'],
			['Можно ли исправить записи?', 'Да. Выберите нужную дату и измените или удалите запись в соответствующем разделе дневника.'],
		],
	},
	'how-to': {
		title: 'Как пользоваться Calm',
		sections: [
			['1. Записывайте приступы', 'Укажите дату и время, интенсивность, симптомы, возможные триггеры и зоны боли. По возможности добавьте время окончания.'],
			['2. Отмечайте лекарства', 'Добавьте препарат, время приёма и дозировку, а затем укажите эффект, если хотите отслеживать результат.'],
			['3. Заполняйте дневник регулярно', 'Отмечайте дни без новых начал приступов, даже если старый приступ продолжается. День без записи и без отметки остаётся неизвестным.'],
			['4. Смотрите закономерности', 'Переключайте даты, просматривайте прогноз и статистику, чтобы обсуждать наблюдения с врачом. Совпадение с триггером само по себе не доказывает причину.'],
			['5. Подготовьте данные к визиту', 'В разделе статистики можно сформировать отчёт и выгрузить записи, чтобы показать их врачу.'],
		],
	},
	condition: {
		title: 'О головной боли',
		sections: [
			['Головная боль бывает разной', 'Мигрень, головная боль напряжения и кластерная головная боль отличаются симптомами и течением. По одному признаку нельзя надёжно определить тип боли — диагноз ставит медицинский специалист.'],
			['Зачем вести дневник', 'Записывайте частоту, длительность и выраженность боли, сопутствующие симптомы, возможные триггеры и принятые препараты. Эти сведения помогают увидеть динамику и подготовиться к разговору с врачом.'],
			['Когда нужна срочная помощь', 'Обратитесь за неотложной медицинской помощью при внезапной очень сильной головной боли, новой слабости или онемении, нарушении речи или зрения, спутанности сознания, высокой температуре с резким ухудшением состояния или головной боли после травмы головы.'],
		],
		sources: [
			{ label: 'Рекомендации NICE по головной боли', href: 'https://www.nice.org.uk/guidance/cg150/chapter/recommendations' },
			{ label: 'Справка NHS о мигрени', href: 'https://www.nhs.uk/conditions/migraine/' },
			{ label: 'ВОЗ: головная боль и другие расстройства', href: 'https://www.who.int/news-room/fact-sheets/detail/headache-disorders' },
		],
	},
}

const FooterHelpSheet = ({ topic, onClose }) => {
	const dialogRef = useRef(null)
	const closeButtonRef = useRef(null)
	const guide = guides[topic]

	useEffect(() => {
		if (!guide) return undefined
		const previousFocus = document.activeElement
		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		closeButtonRef.current?.focus()

		const onKeyDown = event => {
			if (event.key === 'Escape') {
				event.preventDefault()
				onClose(null)
				return
			}
			if (event.key !== 'Tab') return
			const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled), a[href]')]
			if (!focusable.length) {
				event.preventDefault()
				dialogRef.current.focus()
				return
			}
			const first = focusable[0]
			const last = focusable[focusable.length - 1]
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault()
				last.focus()
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault()
				first.focus()
			}
		}

		document.addEventListener('keydown', onKeyDown)
		return () => {
			document.body.style.overflow = previousOverflow
			document.removeEventListener('keydown', onKeyDown)
			if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
		}
	}, [guide, onClose])

	if (!guide) return null

	return createPortal(
		<div className={s.overlay} onClick={event => { if (event.target === event.currentTarget) onClose(null) }}>
			<section ref={dialogRef} className={s.sheet} role="dialog" aria-modal="true" aria-labelledby="footer-guide-title" tabIndex={-1}>
				<div className={s.handle} aria-hidden="true" />
				<button ref={closeButtonRef} type="button" className={s.closeButton} onClick={() => onClose(null)} aria-label="Закрыть памятку">
					<CloseIcon aria-hidden="true" />
				</button>
				<div className={s.content}>
					<h2 className={s.title} id="footer-guide-title">{guide.title}</h2>
					{guide.sections.map(([title, text]) => (
						<section className={s.section} key={title}>
							<h3>{title}</h3>
							<p>{text}</p>
						</section>
					))}
					{guide.sources && <div className={s.sources}>
						<h3>Источники</h3>
						<ul>{guide.sources.map(source => (
							<li key={source.href}><a href={source.href} target="_blank" rel="noreferrer">{source.label}</a></li>
						))}</ul>
					</div>}
					{guide.disclaimer !== false && <p className={s.disclaimer}>Материал носит справочный характер и не заменяет консультацию врача.</p>}
				</div>
			</section>
		</div>,
		document.body,
	)
}

export default FooterHelpSheet
