export const cardsFor = (answers, trackCycle, askCycle = trackCycle, askCycleEnd = false) => [
  'yesterday', 'today', 'sleep',
  ...(answers.sleepMinutes > 0 ? ['quality'] : []), 'stress', 'medication', 'alcohol',
  ...(trackCycle && askCycle ? ['cycle'] : []),
  ...(trackCycle && askCycleEnd ? ['cycleEnd'] : []),
]
export const swipeDirection = (x, y) => {
  if (y > 85 && y > Math.abs(x) * 1.15) return 'down'
  if (Math.abs(x) > 85 && Math.abs(x) > Math.abs(y) * 1.15) return x > 0 ? 'right' : 'left'
  return null
}
export const actionLabels = card => card === 'sleep' ? ['Не спал','Сохранить сон'] : card === 'quality' || card === 'stress' ? ['Сохранить','Сохранить'] : ['Нет','Да']
export const answerFor = (card, direction, fields, today) => {
  const choice = direction === 'down' ? 'UNKNOWN' : direction === 'right' ? 'YES' : 'NO'
  if (card === 'sleep') {
    if (direction === 'down') return { sleepMinutes: null, sleepQuality: null }
    if (direction === 'left') return { sleepMinutes: 0, sleepQuality: null }
    if (fields.hours === '' || fields.minutes === '') throw new Error('Укажите часы и минуты сна')
    const hours = Number(fields.hours || 0), minutes = Number(fields.minutes || 0)
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 24 || minutes < 0 || minutes > 59 || hours * 60 + minutes > 1440 || hours * 60 + minutes === 0)
      throw new Error('Укажите время сна или смахните влево: «Не спал»')
    return { sleepMinutes: hours * 60 + minutes }
  }
  if (card === 'quality' || card === 'stress') {
    const key = card === 'quality' ? 'sleepQuality' : 'stress'
    if (direction === 'down') return { [key]: null }
    if (fields[key] == null) throw new Error(card === 'quality' ? 'Укажите качество сна на шкале' : 'Укажите уровень стресса на шкале')
    return { [key]: fields[key] }
  }
  if (card === 'cycle') {
    if (choice === 'YES' && !today) throw new Error('Не удалось определить сегодняшнюю дату')
    return { menstruating: choice, cycleStart: choice === 'YES' ? today : null }
  }
  if (card === 'cycleEnd') return { cycleEnded: choice }
  return { [{ medication: 'medicationYesterday', alcohol: 'alcoholYesterday' }[card] || card]: choice }
}
export const emptyAnswers = () => ({ yesterday: null, today: null, ongoing: 'UNKNOWN', sleepMinutes: null, sleepQuality: null, stress: null, medicationYesterday: null, alcoholYesterday: null, menstruating: null, cycleStart: null, cycleEnded: null })
