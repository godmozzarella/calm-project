import { Input } from '@/shared/ui/Input'
import s from './DiaryProfileFields.module.scss'

const placeCaretAtEnd = event => {
  const input = event.currentTarget
  requestAnimationFrame(() => {
    if (document.activeElement !== input) return
    const end = input.value.length
    input.setSelectionRange(end, end)
  })
}

export default function DiaryProfileFields({ data, onChange, loading, loaded, onRetry, saving, ageError }) {
  return <fieldset className={s.fields} disabled={loading || saving}>
    <legend className={s.screenReaderOnly}>Для дневника</legend>
    <div className={s.sectionDivider} aria-hidden="true"><span>Для дневника</span></div>
    {loading ? <p role="status">Загружаем данные…</p> : !loaded ? <div className={s.loadError}><button title={"Повторить загрузку"} type="button" onClick={onRetry}>Повторить загрузку</button></div> : <>
      <Input id="age" type="text" label="Возраст" inputMode="numeric" value={data.age} onFocus={placeCaretAtEnd} onChange={onChange} error={ageError}/>
      <Input as="select" id="sex" label="Пол" wrapperClassName={s.sexField} value={data.sex === 'OTHER' ? 'UNSPECIFIED' : data.sex} onChange={onChange}>
        <option value="UNSPECIFIED">Не указывать</option>
        <option value="FEMALE">Женский</option>
        <option value="MALE">Мужской</option>
      </Input>
      {data.sex === 'FEMALE' && <>
        <label className={s.cycle}>
          <span>Вопросы о менструации</span>
          <input id="trackCycle" type="checkbox" checked={data.trackCycle} onChange={onChange} />
        </label>
        <p className={s.hint}>Спрашивать о начале и завершении менструации в карточках.</p>
        {data.trackCycle && <>
          <label className={s.cycle}>
            <span>Вопрос в день запланированного начала</span>
            <input id="confirmPlannedCycle" type="checkbox" checked={data.confirmPlannedCycle !== false} onChange={onChange} />
          </label>
          <p className={s.hint}>Если включено, карточка предложит отметить фактическое начало.</p>
        </>}
      </>}
    </>}
  </fieldset>
}
