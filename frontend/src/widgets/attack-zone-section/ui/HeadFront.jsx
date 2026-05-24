import { useState } from 'react'

const HEAD_PATH = 'M80,16 C130,16 152,56 152,104 C152,160 126,208 80,212 C34,208 8,160 8,104 C8,56 30,16 80,16Z'

const ZONE_SHAPES = {
	crown:        { cx: 80,  cy: 22,  rx: 64,  ry: 50 },
	forehead:     { cx: 80,  cy: 74,  rx: 72,  ry: 36 },
	left_temple:  { cx: 14,  cy: 112, rx: 60,  ry: 50 },
	right_temple: { cx: 146, cy: 112, rx: 60,  ry: 50 },
	face:         { cx: 80,  cy: 170, rx: 58,  ry: 42 },
	left_eye:     { cx: 57,  cy: 112, rx: 26,  ry: 18 },
	right_eye:    { cx: 103, cy: 112, rx: 26,  ry: 18 },
}
const ZONE_ORDER = ['crown', 'forehead', 'left_temple', 'right_temple', 'face', 'left_eye', 'right_eye']

const COLOR = {
	green:  { fill: 'rgba(34,197,94,0.30)',  stroke: 'rgba(34,197,94,0.68)',  hover: 'rgba(34,197,94,0.46)' },
	yellow: { fill: 'rgba(234,179,8,0.33)',  stroke: 'rgba(234,179,8,0.68)',  hover: 'rgba(234,179,8,0.50)' },
	red:    { fill: 'rgba(239,68,68,0.34)',  stroke: 'rgba(239,68,68,0.72)',  hover: 'rgba(239,68,68,0.52)' },
}
const IDLE       = 'rgba(255,255,255,0.04)'
const IDLE_STR   = 'rgba(255,255,255,0.09)'
const IDLE_HOV   = 'rgba(255,255,255,0.13)'
const IDLE_HOVS  = 'rgba(255,255,255,0.18)'

const c = {
	base:    'rgba(40,45,62,1)',
	ear:     'rgba(44,49,68,1)',
	stroke:  'rgba(92,173,228,0.22)',
	feature: 'rgba(180,192,215,0.16)',
}

// zones: { [zoneName]: 'green'|'yellow'|'red' }
const HeadFront = ({ zones = {}, onToggle, readOnly = false }) => {
	const [hovered, setHovered] = useState(null)

	const getStyle = zone => {
		const color = zones[zone]
		const isHov = hovered === zone && !readOnly
		if (!color) return {
			fill:        isHov ? IDLE_HOV  : IDLE,
			stroke:      isHov ? IDLE_HOVS : IDLE_STR,
			strokeWidth: 0.7,
		}
		const col = COLOR[color]
		return {
			fill:        isHov ? col.hover : col.fill,
			stroke:      col.stroke,
			strokeWidth: 1.2,
		}
	}

	const handlers = zone => readOnly ? {} : {
		onClick:      () => onToggle(zone),
		onMouseEnter: () => setHovered(zone),
		onMouseLeave: () => setHovered(null),
	}

	return (
		<svg viewBox="0 0 160 228" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', display: 'block' }}>
			<defs>
				<clipPath id="hf-clip">
					<path d={HEAD_PATH} />
				</clipPath>
			</defs>

			<ellipse cx="7"   cy="112" rx="9" ry="22" fill={c.ear}  stroke={c.stroke} strokeWidth="1" />
			<ellipse cx="153" cy="112" rx="9" ry="22" fill={c.ear}  stroke={c.stroke} strokeWidth="1" />
			<path d={HEAD_PATH} fill={c.base} stroke={c.stroke} strokeWidth="1.5" />
			<path d="M38,34 Q80,17 122,34" fill="none" stroke={c.feature} strokeWidth="1.2" strokeLinecap="round" />

			<g clipPath="url(#hf-clip)" style={{ cursor: readOnly ? 'default' : 'pointer' }}>
				{ZONE_ORDER.map(zone => {
					const { cx, cy, rx, ry } = ZONE_SHAPES[zone]
					const st = getStyle(zone)
					return (
						<ellipse
							key={zone}
							cx={cx} cy={cy} rx={rx} ry={ry}
							fill={st.fill} stroke={st.stroke} strokeWidth={st.strokeWidth}
							style={{ transition: 'fill 0.14s, stroke 0.14s' }}
							{...handlers(zone)}
						/>
					)
				})}
			</g>

			{/* decorative face features, pointer-events: none */}
			<path d="M42,98 Q57,90 72,98"  fill="none" stroke={c.feature} strokeWidth="1.4" strokeLinecap="round" style={{ pointerEvents: 'none' }} />
			<path d="M88,98 Q103,90 118,98" fill="none" stroke={c.feature} strokeWidth="1.4" strokeLinecap="round" style={{ pointerEvents: 'none' }} />
			<path d="M44,112 Q57,104 70,112 Q57,120 44,112Z"  fill="rgba(28,32,50,0.85)" stroke={c.feature} strokeWidth="0.8" style={{ pointerEvents: 'none' }} />
			<path d="M90,112 Q103,104 116,112 Q103,120 90,112Z" fill="rgba(28,32,50,0.85)" stroke={c.feature} strokeWidth="0.8" style={{ pointerEvents: 'none' }} />
			<path d="M78,124 L74,148 Q80,152 86,148 L82,124"  fill="rgba(28,32,50,0.55)" stroke={c.feature} strokeWidth="0.8" style={{ pointerEvents: 'none' }} />
			<path d="M63,170 Q80,181 97,170" fill="none" stroke={c.feature} strokeWidth="1.2" strokeLinecap="round" style={{ pointerEvents: 'none' }} />
		</svg>
	)
}

export default HeadFront
