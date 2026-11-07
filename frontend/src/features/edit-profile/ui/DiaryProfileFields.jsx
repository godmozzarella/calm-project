import { Input } from '@/shared/ui/Input'
import s from './DiaryProfileFields.module.scss'

export default function DiaryProfileFields({ data, onChange, loading, loaded, onRetry, saving }) {
  return <fieldset className={s.fields} disabled={loading || saving}>
    <legend className={s.screenReaderOnly}>Для дневника</legend>
    <div className={s.sectionDivider} aria-hidden="true"><span>Для дневника</span></div>
    <p className={s.description}>Помогает подобрать вопросы в ежедневном опросе.</p>
    {loading ? <p role="status">Загружаем данные…</p> : !loaded ? <div className={s.loadError}><p>Не удалось загрузить данные.</p><button type="button" onClick={onRetry}>Повторить</button></div> : <>
      <Input id="age" type="number" label="Возраст" hint="Можно не указывать" inputMode="numeric" min="1" max="120" step="1" value={data.age} onChange={onChange}/>
      <div className={s.selectField}>
        <label htmlFor="sex">Пол</label>
        <select id="sex" value={data.sex} onChange={onChange}>
          <option value="UNSPECIFIED">Не указывать</option><option value="FEMALE">Женский</option><option value="MALE">Мужской</option><option value="OTHER">Другой</option>
        </select>
      </div>
      {data.sex === 'FEMALE' && <>
        <label className={s.cycle}><input id="trackCycle" type="checkbox" checked={data.trackCycle} onChange={onChange}/><span className={s.checkVisual} aria-hidden="true"/><span>Вопросы о менструации</span></label>
        <p className={s.hint}>Спрашивать о начале и завершении менструации в карточках.</p>
      </>}
    </>}
  </fieldset>
}
