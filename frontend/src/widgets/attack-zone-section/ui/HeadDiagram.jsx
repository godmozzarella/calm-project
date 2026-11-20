import { useId, useState } from 'react'
import { PAIN_ZONE_LABELS } from '@/entities/attack'

const EARS = 'M32 80 Q12 72 18 103 Q22 120 35 118 M136 80 Q156 72 150 103 Q146 120 133 118'

const front = {
	silhouette: 'M84 13 C47 13 29 39 30 73 L31 106 C34 131 47 145 64 155 L63 167 L49 181 H119 L105 167 L104 155 C121 145 134 131 137 106 L138 73 C139 39 121 13 84 13 Z',
	features: 'M49 80 q12 -7 24 -3 m22 0 q12 -4 24 3 M49 94 q12 -9 24 0 q-12 7 -24 0 Z M95 94 q12 -9 24 0 q-12 7 -24 0 Z M84 94 l-6 22 q6 5 13 0 m-20 20 q13 -5 26 0 m-22 5 q9 3 18 0',
	zones: {
		crown: 'M0 0 H168 V56 Q147 48.5 126 44.75 Q84 37.25 42 44.75 Q21 48.5 0 56 Z',
		forehead: 'M42 44.75 Q84 37.25 126 44.75 L123 83 Q103.5 77 84 77 Q64.5 77 45 83 Z',
		right_temple: 'M0 56 Q21 48.5 42 44.75 L45 83 Q35 105 45 119 H0 Z',
		left_temple: 'M168 56 Q147 48.5 126 44.75 L123 83 Q133 105 123 119 H168 Z',
		right_eye: 'M45 83 Q64.5 77 84 77 V113 Q64.5 113 45 119 Q35 105 45 83 Z',
		left_eye: 'M123 83 Q103.5 77 84 77 V113 Q103.5 113 123 119 Q133 105 123 83 Z',
		face: 'M0 119 H45 Q64.5 113 84 113 Q103.5 113 123 119 H168 V192 H0 Z',
	},
}

const back = {
	silhouette: 'M84 13 C48 13 28 35 29 76 C29 108 36 135 57 149 V164 L44 181 H124 L111 164 V149 C132 135 139 108 139 76 C140 35 120 13 84 13 Z',
	features: 'M40 116 q16 16 30 20 m58 -20 q-16 16 -30 20 M64 162 l-4 16 m44 -16 l4 16',
	zones: {
		crown: 'M0 0 H168 V65 Q126 53 84 53 Q42 53 0 65 Z',
		left_occiput: 'M0 65 Q42 53 84 53 V141 Q42 141 0 156 Z',
		right_occiput: 'M168 65 Q126 53 84 53 V141 Q126 141 168 156 Z',
		neck: 'M0 156 Q42 141 84 141 Q126 141 168 156 V192 H0 Z',
	},
}

const fills = {
	green: ['rgba(34,197,94,.3)', 'rgba(34,197,94,.46)'],
	yellow: ['rgba(234,179,8,.33)', 'rgba(234,179,8,.5)'],
	red: ['color-mix(in srgb, var(--error-color) 34%, transparent)', 'color-mix(in srgb, var(--error-color) 52%, transparent)'],
	idle: ['var(--head-idle)', 'var(--head-idle-hover)'],
}

export default function HeadDiagram({ rear = false, zones = {}, onToggle, readOnly = false }) {
	const clipId = useId()
	const [hovered, setHovered] = useState(null)
	const diagram = rear ? back : front

	return (
		<svg viewBox="0 0 168 192" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', display: 'block' }}>
			<defs><clipPath id={clipId}><path d={diagram.silhouette} /></clipPath></defs>
			<path d={EARS} fill="var(--head-ear)" />
			<path d={diagram.silhouette} fill="var(--head-base)" />
			<g clipPath={`url(#${clipId})`} style={{ cursor: readOnly ? 'default' : 'pointer' }}>
				{Object.entries(diagram.zones).map(([zone, path]) => {
					const fill = fills[zones[zone]] ?? fills.idle
					const label = PAIN_ZONE_LABELS[zone]
					return (
						<path key={zone} d={path}
							fill={fill[!readOnly && hovered === zone ? 1 : 0]}
							stroke="var(--head-base)" strokeWidth="1.5" strokeLinejoin="round"
							style={{ transition: 'fill .14s' }}
							{...(!readOnly && {
								role: 'button',
								tabIndex: 0,
								'aria-label': `Зона боли: ${label}`,
								'aria-pressed': Boolean(zones[zone]),
								onClick: () => onToggle(zone),
								onMouseEnter: () => setHovered(zone),
								onMouseLeave: () => setHovered(null),
								onKeyDown: event => {
									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault()
										onToggle(zone)
									}
								},
							})}>
							<title>{readOnly ? `Зона боли: ${label}` : `Отметить зону «${label}». Повторные нажатия меняют силу боли и снимают отметку.`}</title>
						</path>
					)
				})}
			</g>
			<path d={diagram.features} fill="none" stroke="var(--head-feature)" strokeWidth="1.6"
				strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
		</svg>
	)
}
