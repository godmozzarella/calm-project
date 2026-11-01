import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import BlueOrb from '@/shared/ui/BlueOrb/BlueOrb'
import s from './AboutLogoShowcase.module.scss'

const createNeonGeometry = () => {
	const shape = new THREE.Shape()
	const cornerTension = .13
	const roundness = .2
	const scale = 1.12
	const tips = [[0, 1], [1, 0], [0, -1], [-1, 0]]
	const controls = [
		[cornerTension, cornerTension],
		[cornerTension, -cornerTension],
		[-cornerTension, -cornerTension],
		[-cornerTension, cornerTension],
	]
	const bezierPoint = (start, control, end, t) => {
		const inverse = 1 - t
		return [
			inverse * inverse * start[0] + 2 * inverse * t * control[0] + t * t * end[0],
			inverse * inverse * start[1] + 2 * inverse * t * control[1] + t * t * end[1],
		]
	}
	const bezierDerivative = (start, control, end, t) => [
		2 * ((1 - t) * (control[0] - start[0]) + t * (end[0] - control[0])),
		2 * ((1 - t) * (control[1] - start[1]) + t * (end[1] - control[1])),
	]
	const scaled = point => [point[0] * scale, point[1] * scale]
	const sections = tips.map((start, index) => {
		const end = tips[(index + 1) % tips.length]
		const control = controls[index]
		const from = bezierPoint(start, control, end, roundness)
		const to = bezierPoint(start, control, end, 1 - roundness)
		const derivativeFrom = bezierDerivative(start, control, end, roundness)
		const derivativeTo = bezierDerivative(start, control, end, 1 - roundness)
		const tangentControl = (1 - 2 * roundness) / 2
		return {
			from,
			to,
			derivativeFrom,
			derivativeTo,
			control: [
				from[0] + tangentControl * derivativeFrom[0],
				from[1] + tangentControl * derivativeFrom[1],
			],
		}
	})
	const first = scaled(sections[0].from)
	shape.moveTo(first[0], first[1])
	sections.forEach((section, index) => {
		const next = sections[(index + 1) % sections.length]
		const control = scaled(section.control)
		const end = scaled(section.to)
		shape.quadraticCurveTo(control[0], control[1], end[0], end[1])
		const offset = [next.from[0] - section.to[0], next.from[1] - section.to[1]]
		const determinant = -section.derivativeTo[0] * next.derivativeFrom[1]
			+ next.derivativeFrom[0] * section.derivativeTo[1]
		const tangentAmount = (offset[0] * -next.derivativeFrom[1]
			+ next.derivativeFrom[0] * offset[1]) / determinant
		const join = scaled([
			section.to[0] + tangentAmount * section.derivativeTo[0],
			section.to[1] + tangentAmount * section.derivativeTo[1],
		])
		const nextStart = scaled(next.from)
		shape.quadraticCurveTo(join[0], join[1], nextStart[0], nextStart[1])
	})
	const geometry = new THREE.ExtrudeGeometry(shape, {
		depth: .45,
		bevelEnabled: true,
		bevelThickness: .14,
		bevelSize: .14 * .85,
		bevelSegments: 16,
		curveSegments: 40,
	})
	geometry.center()
	return geometry
}

const AboutLogoShowcase = ({ className = '' }) => {
	const canvasRef = useRef(null)
	const stageRef = useRef(null)

	useEffect(() => {
		const canvas = canvasRef.current
		const stage = stageRef.current
		const section = stage?.closest('section')
		if (!canvas || !stage || !section) return undefined

		let renderer
		try {
			renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
		} catch {
			return undefined
		}
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
		renderer.setClearColor(0x000000, 0)

		const scene = new THREE.Scene()
		const camera = new THREE.PerspectiveCamera(32, 1, .1, 50)
		camera.position.set(0, 0, 5.2)
		scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x08131d, .9))
		const keyLight = new THREE.DirectionalLight(0x88ccff, .9)
		keyLight.position.set(3, 4, 5)
		scene.add(keyLight)
		const fillLight = new THREE.DirectionalLight(0x88ccff, .8)
		fillLight.position.set(-4, -2, 3)
		scene.add(fillLight)

		const geometry = createNeonGeometry()
		const material = new THREE.MeshPhongMaterial({
			color: 0x0b2a3d,
			emissive: 0x0a4a6e,
			specular: 0x66ccff,
			shininess: 60,
		})
		const star = new THREE.Group()
		star.add(new THREE.Mesh(geometry, material))
		const edges = new THREE.EdgesGeometry(geometry, 25)
		star.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x6ec6ff })))
		star.rotation.set(-.18, -.7, 0)
		scene.add(star)

		const resize = () => {
			const { width, height } = stage.getBoundingClientRect()
			if (!width || !height) return
			renderer.setSize(width, height, false)
			camera.aspect = width / height
			camera.updateProjectionMatrix()
		}
		const resizeObserver = new ResizeObserver(resize)
		resizeObserver.observe(stage)
		resize()

		let animationFrame = 0
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		const animate = time => {
			if (!reducedMotion) star.rotation.y = -.7 + Math.sin(time / 1400) * .12
			renderer.render(scene, camera)
			animationFrame = window.requestAnimationFrame(animate)
		}
		animationFrame = window.requestAnimationFrame(animate)

		return () => {
			resizeObserver.disconnect()
			window.cancelAnimationFrame(animationFrame)
			edges.dispose()
			geometry.dispose()
			material.dispose()
			renderer.dispose()
		}
	}, [])

	return (
		<div className={`${s.showcase} ${className}`} role="img" aria-label="Наклонённая неоновая 3D-звезда Calm">
			<div className={s.stage} ref={stageRef}>
				<BlueOrb className={s.bluePulse} />
				<canvas ref={canvasRef} aria-hidden="true" />
			</div>
		</div>
	)
}

export default AboutLogoShowcase
