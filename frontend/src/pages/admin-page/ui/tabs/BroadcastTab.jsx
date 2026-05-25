import s from './Tab.module.scss'

const BroadcastTab = () => {
	return (
		<div className={s.wrap}>
			<h2 className={s.h2}>Рассылка <span className={s.tag}>Скоро</span></h2>
			<p className={s.muted}>
				Здесь будет форма для отправки email-уведомлений всем пользователям,
				у которых в профиле включены уведомления. Функционал в разработке.
			</p>

			<form className={s.formStack} onSubmit={e => e.preventDefault()}>
				<label className={s.field}>
					<span>Тема письма</span>
					<input type="text" className={s.input} disabled placeholder="Заглушка" />
				</label>
				<label className={s.field}>
					<span>Текст письма</span>
					<textarea className={s.input} rows={6} disabled placeholder="Заглушка" />
				</label>
				<button type="submit" className={s.btn} disabled>Отправить (скоро)</button>
			</form>
		</div>
	)
}

export default BroadcastTab
