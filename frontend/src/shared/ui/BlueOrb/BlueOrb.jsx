import s from './BlueOrb.module.scss'

const BlueOrb = ({ className = '' }) => <span className={`${s.orb} ${className}`} aria-hidden="true" />

export default BlueOrb
