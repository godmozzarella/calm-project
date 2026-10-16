import { Link } from 'react-router-dom'
import s from './VerifyEmailPage.module.scss'

export default function VerifyEmailPage() {
	return <main className={s.page}>
		<h1>Подтверждение email</h1>
		<p className={s.status}>Подтверждение теперь проходит по четырёхзначному коду в настройках профиля.</p>
		<Link to="/profile" className={s.link}>Открыть профиль</Link>
	</main>
}
