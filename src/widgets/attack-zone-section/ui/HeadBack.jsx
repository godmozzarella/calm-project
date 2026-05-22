import { useState } from 'react'

const HEAD_PATH = 'M80,16 C132,16 154,58 154,106 C154,164 128,210 80,213 C32,210 6,164 6,106 C6,58 28,16 80,16Z'

const COLOR = {
	green:  { fill: 'rgba(34,197,94,0.30)',  stroke: 'rgba(34,197,94,0.68)',  hover: 'rgba(34,197,94,0.46)' },
	yellow: { fill: 'rgba(234,179,8,0.33)',  stroke: 'rgba(234,179,8,0.68)',  hover: 'rgba(234,179,8,0.50)' },
	red:    { fill: 'rgba(239,68,68,0.34)',  stroke: 'rgba(239,68,68,0.72)',  hover: 'rgba(239,68,68,0.52)' },
}
const IDLE      = 'rgba(255,255,255,0.04)'
const IDLE_STR  = 'rgba(255,255,255,0.09)'
const IDLE_HOV  = 'rgba(255,255,255,0.13)'
const IDLE_HOVS = 'rgba(255,255,255,0.18)'

const c = {
	base:    'rgba(40,45,62,1)',
	ear:     'rgba(44,49,68,1)',
	stroke:  'rgba(92,173,228,0.22)',
	feature: 'rgba(180,192,215,0.14)',
}

// zones: { [zoneName]: 'green'|'yellow'|'red' }
const HeadBack = ({ zones = {}, onToggle, readOnly = false }) => {
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

	const zoneEl = (zone, cx, cy, rx, ry) => {
		const st = getStyle(zone)
		return (
			<ellipse
				key={zone}
				cx={cx} cy={cy} rx={rx} ry={ry}
				fill={st.fill} stroke={st.stroke} strokeWidth={st.strokeWidth}
				style={{ transition: 'fill 0.14s, stroke 0.14s', cursor: readOnly ? 'default' : 'pointer' }}
				{...handlers(zone)}
			/>
		)
	}

	return (
		<svg viewBox="0 0 160 228" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', display: 'block' }}>
			<defs>
				<clipPath id="hb-clip">
					<path d={HEAD_PATH} />
				</clipPath>
				<clipPath id="hb-left">
					<rect x="0" y="0" width="80" height="228" />
				</clipPath>
				<clipPath id="hb-right">
					<rect x="80" y="0" width="80" height="228" />
				</clipPath>
			</defs>

			<ellipse cx="5"   cy="112" rx="9" ry="22" fill={c.ear}  stroke={c.stroke} strokeWidth="1" />
			<ellipse cx="155" cy="112" rx="9" ry="22" fill={c.ear}  stroke={c.stroke} strokeWidth="1" />
			<path d={HEAD_PATH} fill={c.base} stroke={c.stroke} strokeWidth="1.5" />
			<path d="M38,30 Q80,14 122,30" fill="none" stroke={c.feature} strokeWidth="1.2" strokeLinecap="round" />
			<path d="M48,40 Q80,28 112,40" fill="none" stroke={c.feature} strokeWidth="0.8"  strokeLinecap="round" />

			<g clipPath="url(#hb-clip)">
				{/* Crown */}
				{zoneEl('crown', 80, 22, 66, 52)}

				{/* Left occiput — clipped to left half */}
				<g clipPath="url(#hb-left)">
					{zoneEl('left_occiput', 36, 118, 66, 68)}
				</g>

				{/* Right occiput — clipped to right half */}
				<g clipPath="url(#hb-right)">
					{zoneEl('right_occiput', 124, 118, 66, 68)}
				</g>

				{/* Neck */}
				{zoneEl('neck', 80, 198, 50, 30)}
			</g>

			<path d="M28,135 Q80,148 132,135" fill="none" stroke={c.feature} strokeWidth="0.8" strokeLinecap="round" style={{ pointerEvents: 'none' }} />
			<path d="M58,198 Q80,205 102,198" fill="none" stroke={c.feature} strokeWidth="1"   strokeLinecap="round" style={{ pointerEvents: 'none' }} />
		</svg>
	)
}

export default HeadBack
