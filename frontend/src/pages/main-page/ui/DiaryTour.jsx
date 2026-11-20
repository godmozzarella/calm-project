import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { Button } from '@/shared/ui/Button'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import s from './DiaryTour.module.scss'

const steps = [
	{ target: '[data-tour="attacks"]', title: 'Приступы', text: 'Нажмите плюс, чтобы записать новый приступ. Укажите, когда он начался и насколько сильно болела голова.' },
	{ target: '[data-tour="medications"]', title: 'Препараты', text: 'Нажмите плюс, чтобы записать, какой препарат вы приняли, в какое время и в какой дозировке.' },
	{ target: '[data-tour="zones"]', title: 'Зоны боли', text: 'Выберите записанный приступ, нажмите карандаш и отметьте на схеме, где болела голова.' },
	{ target: '[data-streak-target]', title: 'Опрос и серия', text: 'Нажмите звезду, чтобы открыть ежедневный опрос. Каждый день подряд с пройденным опросом добавляет один день к серии.' },
	{ target: '[data-tour="calendar"]', title: 'Календарь', text: 'Откройте календарь и выберите дату, чтобы посмотреть записи дневника за этот день.' },
	{ target: '[data-tour="forecast"]', title: 'Прогноз', text: 'Здесь можно посмотреть риск головной боли и факторы, которые на него влияют. Для прогноза укажите город.' },
]

export default function DiaryTour({ onClose }) {
	const [index, setIndex] = useState(0)
	const [highlight, setHighlight] = useState(null)
	const dialogRef = useRef(null)
	const panelRef = useRef(null)
	const { target, title, text } = steps[index]
	const last = index === steps.length - 1
	useBodyScrollLock(true)

	useLayoutEffect(() => {
		const dialog = dialogRef.current
		dialog.showModal()
		return () => dialog.close()
	}, [])

	useEffect(() => {
		const element = document.querySelector(target)
		if (!element) return undefined
		const measure = () => {
			const rect = element.getBoundingClientRect()
			const viewport = dialogRef.current.getBoundingClientRect()
			const left = Math.max(4, rect.left - viewport.left - 6)
			const top = Math.max(4, rect.top - viewport.top - 6)
			const right = Math.min(viewport.width - 4, rect.right - viewport.left + 6)
			const bottom = Math.min(viewport.height - 4, rect.bottom - viewport.top + 6)
			setHighlight(right > left && bottom > top ? { left, top, right, bottom, viewportHeight: viewport.height } : null)
		}
		const frame = requestAnimationFrame(() => {
			if (getComputedStyle(element).position !== 'fixed') {
				element.scrollIntoView({ block: 'center', behavior: 'instant' })
			}
			measure()
		})
		const observer = new ResizeObserver(measure)
		observer.observe(element)
		observer.observe(dialogRef.current)
		window.addEventListener('scroll', measure, { passive: true })
		return () => {
			cancelAnimationFrame(frame)
			observer.disconnect()
			window.removeEventListener('scroll', measure)
		}
	}, [target])

	useLayoutEffect(() => {
		panelRef.current.focus({ preventScroll: true })
	}, [index])

	const panelAbove = highlight && highlight.top > highlight.viewportHeight - highlight.bottom

	return (
		<dialog ref={dialogRef} className={s.overlay} aria-labelledby="diary-tour-title" aria-describedby="diary-tour-description"
			onCancel={event => { event.preventDefault(); onClose() }}>
			{highlight && <div className={s.highlight} style={{
				top: highlight.top, left: highlight.left,
				width: highlight.right - highlight.left, height: highlight.bottom - highlight.top,
			}} />}
			<section ref={panelRef} tabIndex={-1}
				className={`${s.panel} ${panelAbove ? s.panelAbove : ''}`}
				style={highlight ? {
					'--panel-offset': `${panelAbove ? highlight.viewportHeight - highlight.top + 12 : highlight.bottom + 12}px`,
				} : undefined}>
				<p className={s.progress}>Шаг {index + 1} из {steps.length}</p>
				<h2 id="diary-tour-title">{title}</h2>
				<p id="diary-tour-description">{text}</p>
				<div className={s.actions}>
					{!last && <Button type="button" className={s.secondary} onClick={onClose}>Пропустить</Button>}
					{index > 0 && <Button type="button" className={s.secondary} onClick={() => setIndex(index - 1)}>Назад</Button>}
					<Button type="button" colored onClick={last ? onClose : () => setIndex(index + 1)}>
						{last ? 'Готово' : 'Далее'}
					</Button>
				</div>
			</section>
		</dialog>
	)
}
