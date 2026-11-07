const parts = date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '')
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null
}

const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate()

export const cycleDateParts = date => {
  const value = parts(date)
  return { day: value ? String(value.day) : '', month: value ? String(value.month) : '' }
}

export const maxCycleDay = (month, today) => {
  const current = parts(today)
  const selectedMonth = Number(month)
  if (!current || !Number.isInteger(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) return 31
  return Math.max(daysInMonth(current.year, selectedMonth), daysInMonth(current.year - 1, selectedMonth))
}

// No year is shown in the picker. Keep the most recent occurrence of day/month.
export const resolveCycleDate = (day, month, today) => {
  const current = parts(today)
  const selectedDay = Number(day), selectedMonth = Number(month)
  if (!current || day === '' || month === '' || !Number.isInteger(selectedDay) || !Number.isInteger(selectedMonth)
      || selectedMonth < 1 || selectedMonth > 12 || selectedDay < 1) return ''
  for (const year of [current.year, current.year - 1]) {
    if (selectedDay > daysInMonth(year, selectedMonth)) continue
    const date = `${year}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    if (date <= today) return date
  }
  return ''
}

export const changeCyclePart = (fields, part, value, today) => {
  const current = cycleDateParts(today)
  const selected = cycleDateParts(fields.cycleStart)
  let day = part === 'day' ? value : fields.cycleDay ?? selected.day ?? ''
  let month = part === 'month' ? value : fields.cycleMonth ?? selected.month ?? ''
  if (day === '') day = current.day
  if (month === '') month = current.month
  if (part === 'month' && Number(day) > maxCycleDay(month, today)) day = String(maxCycleDay(month, today))
  return { ...fields, cycleDay: day, cycleMonth: month, cycleStart: resolveCycleDate(day, month, today) }
}
