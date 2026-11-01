import { useEffect, useRef, useState } from 'react'
import s from './HowToCarousel.module.scss'

const slides = [
	{
		title: 'Ведите дневник приступов',
		text: 'Сохраняйте приступы, симптомы и самочувствие, чтобы видеть историю наблюдений в одном месте.',
		image: 'note.PNG',
		alt: 'Дневник с записями о приступах и препаратами'
	},
	{
		title: 'Добавляйте препараты',
		text: 'Сохраняйте препараты и дозировки, а затем отмечайте приём и то, насколько лекарство помогло.',
		image: 'medecament.PNG',
		alt: 'Раздел препаратов в дневнике головной боли'
	},
	{
		title: 'Ориентируйтесь в календаре',
		text: 'Календарь собирает отметки о приступах, препаратах и заметках по дням.',
		image: 'calendar.PNG',
		alt: 'Заполненный календарь с отметками приступов, лекарств и заметок'
	},
	{
		title: 'Изучайте статистику',
		text: 'Смотрите частоту и интенсивность приступов, серии дней без боли и другие итоги за выбранный период.',
		image: 'grafic.PNG',
		alt: 'График статистики приступов и сводные показатели'
	},
	{
		title: 'Смотрите прогноз головной боли',
		text: 'Смотрите оценку по дням и факторы, которые учитываются в прогнозе.',
		image: 'predict.PNG',
		alt: 'Прогноз головной боли с оценкой риска по дням и влияющими факторами'
	},
	{
		title: 'Отмечайте зоны боли',
		text: 'Выберите приступ и укажите на схеме, где болела голова. Зоны сохранятся вместе с записью этого приступа.',
		image: 'zone.PNG',
		alt: 'Схема головы для выбора зон боли у выбранного приступа'
	}
]
const trackSlides = [slides[slides.length - 1], ...slides, slides[0]]

const HowToCarousel = () => {
	const [trackIndex, setTrackIndex] = useState(1)
	const [paused, setPaused] = useState(false)
	const [touchHeld, setTouchHeld] = useState(false)
	const [isPageActive, setIsPageActive] = useState(() => !document.hidden)
	const [snapping, setSnapping] = useState(false)
	const touchStart = useRef(null)
	const countdown = useRef({ index: 1, remaining: 10_000 })
	const carouselRef = useRef(null)
	const activeIndex = trackIndex === 0 ? slides.length - 1 : trackIndex === slides.length + 1 ? 0 : trackIndex - 1
	const move = direction => setTrackIndex(index => {
		const next = index + direction
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && next === 0) return slides.length
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && next === slides.length + 1) return 1
		return Math.max(0, Math.min(slides.length + 1, next))
	})

	useEffect(() => {
		const updateVisibility = () => setIsPageActive(!document.hidden && document.hasFocus())
		const onFocus = () => setIsPageActive(!document.hidden)
		const onBlur = () => setIsPageActive(false)
		document.addEventListener('visibilitychange', updateVisibility)
		window.addEventListener('focus', onFocus)
		window.addEventListener('blur', onBlur)
		return () => {
			document.removeEventListener('visibilitychange', updateVisibility)
			window.removeEventListener('focus', onFocus)
			window.removeEventListener('blur', onBlur)
		}
	}, [])

	useEffect(() => {
        if (countdown.current.index !== trackIndex) countdown.current = { index: trackIndex, remaining: 10_000 }
        if (!isPageActive || paused || touchHeld || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
        const started = performance.now()
        const timer = window.setTimeout(() => setTrackIndex(index => index >= slides.length + 1 ? 1 : index + 1), countdown.current.remaining)
        return () => {
            window.clearTimeout(timer)
            countdown.current.remaining = Math.max(0, countdown.current.remaining - (performance.now() - started))
        }
    }, [trackIndex, isPageActive, paused, touchHeld])

    // transitionend can be lost when the tab is hidden mid-transition.
    useEffect(() => {
        if (trackIndex !== 0 && trackIndex !== slides.length + 1) return undefined
        const timer = window.setTimeout(() => {
            setSnapping(true)
            setTrackIndex(trackIndex === 0 ? slides.length : 1)
        }, 700)
        return () => window.clearTimeout(timer)
    }, [trackIndex])

	useEffect(() => {
		if (!snapping) return undefined
		let secondFrame
		const firstFrame = window.requestAnimationFrame(() => {
			secondFrame = window.requestAnimationFrame(() => setSnapping(false))
		})
		return () => {
			window.cancelAnimationFrame(firstFrame)
			if (secondFrame) window.cancelAnimationFrame(secondFrame)
		}
	}, [snapping])

	const onTrackTransitionEnd = event => {
		if (event.target !== event.currentTarget) return
		if (trackIndex === 0 || trackIndex === slides.length + 1) {
			setSnapping(true)
			setTrackIndex(trackIndex === 0 ? slides.length : 1)
		}
	}

	const onTouchStart = event => {
		setTouchHeld(true)
		const touch = event.changedTouches[0]
		touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null
	}
	const onTouchEnd = event => {
		setTouchHeld(false)
		if (touchStart.current === null) return
		const touch = event.changedTouches[0]
		if (!touch) {
			touchStart.current = null
			return
		}
		const distanceX = touch.clientX - touchStart.current.x
		const distanceY = touch.clientY - touchStart.current.y
		if (Math.abs(distanceX) > 45 && Math.abs(distanceX) > Math.abs(distanceY) * 1.25) {
			move(distanceX < 0 ? 1 : -1)
		}
		touchStart.current = null
	}
	const onKeyDown = event => {
		if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
		if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
	}
	const onSlideClick = event => {
		if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
		const { left, width } = event.currentTarget.getBoundingClientRect()
		move(event.clientX < left + width / 2 ? -1 : 1)
	}

	return (
		<section id="about" className={s.section}>
			<div className={s.container}>
				<header className={s.heading}>
					<h2>Как пользоваться <span className={s.inTextLogo}>Calm</span>?</h2>
				</header>
				<div
					ref={carouselRef}
					className={s.carousel}
					role="region"
					aria-label="Как пользоваться Calm"
					aria-roledescription="карусель"
					tabIndex={0}
					onKeyDown={onKeyDown}
					onTouchStart={onTouchStart}
					onTouchEnd={onTouchEnd}
					onTouchCancel={() => { touchStart.current = null; setTouchHeld(false) }}
					onPointerEnter={event => { if (event.pointerType === 'mouse') setPaused(true) }}
					onPointerLeave={event => { if (event.pointerType === 'mouse') setPaused(false) }}
					onFocusCapture={event => {
						if (event.target.matches(':focus-visible')) setPaused(true)
					}}
					onBlurCapture={event => {
						if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
					}}
				>
					<div className={s.slideViewport} onClick={onSlideClick}>
						<div className={s.slideTrack} onTransitionEnd={onTrackTransitionEnd} style={{ transform: `translate3d(-${trackIndex * 100}%, 0, 0)`, transition: snapping ? 'none' : undefined }}>
							{trackSlides.map((slide, position) => {
								const index = position === 0 ? slides.length - 1 : position === slides.length + 1 ? 0 : position - 1
								return <article className={s.slide} key={`${position}-${slide.image}`} role="group" aria-roledescription="слайд" aria-label={slide.title} aria-hidden={trackIndex !== position}>
									<div className={s.phoneStage}>
										<div className={s.phone}>
										<div className={s.phoneScreen}>
											<img className={s.screenshot} src={`/screens/${slide.image}`} alt={slide.alt} width="1170" height="2532" loading="eager" />
										</div>
										<img className={s.phoneMockup} src="/mockup_1_front.png" alt="" aria-hidden="true" loading="eager" decoding="async" fetchPriority="high" />
										</div>
									</div>
									<div className={s.slideCopy} aria-live={index === activeIndex ? 'polite' : undefined} aria-atomic="true">
										<h3>{slide.title}</h3>
										<p>{slide.text}</p>
									</div>
								</article>
							})}
						</div>
                        <button type="button" className={`${s.edgeControl} ${s.edgeLeft}`} aria-label="Предыдущий слайд" onClick={event => { event.stopPropagation(); move(-1) }} />
                        <button type="button" className={`${s.edgeControl} ${s.edgeRight}`} aria-label="Следующий слайд" onClick={event => { event.stopPropagation(); move(1) }} />
					</div>
					<div className={s.controls}>
						<div className={s.dots} role="group" aria-label="Выбрать шаг">
							{slides.map((slide, index) => (
								<button
									key={slide.title}
									type="button"
									className={`${s.dot} ${activeIndex === index ? s.activeDot : ''}`}
									aria-label={`Шаг ${index + 1}: ${slide.title}`}
									aria-pressed={activeIndex === index}
									onClick={() => setTrackIndex(index + 1)}
								>
										{activeIndex === index && <span key={trackIndex} className={s.dotProgress} style={{ animationPlayState: paused || touchHeld || !isPageActive ? 'paused' : 'running' }} />}
								</button>
							))}
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

export default HowToCarousel
