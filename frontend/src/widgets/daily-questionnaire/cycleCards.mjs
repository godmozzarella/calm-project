export const cycleCards = {
  INITIAL: {
    title: 'Месячные начались сегодня?',
    left: ['NO', 'Нет'], right: ['YES', 'Да, сегодня'],
    date: ['EARLIER', 'Указать дату последних месячных'], snooze: true,
  },
  START: {
    title: 'Месячные начались?',
    left: ['NO', 'Нет'], right: ['YES', 'Да, сегодня'],
    date: ['EARLIER', 'Начались раньше'], snooze: true,
  },
  LATE_START: {
    title: 'Месячные начались?',
    hint: 'Давно нет отметок. Если сейчас пауза, вопросы можно отключить.',
    left: ['NO', 'Нет'], right: ['YES', 'Да, сегодня'],
    date: ['EARLIER', 'Начались раньше'], snooze: true,
  },
  END: {
    title: 'Месячные закончились?',
    left: ['NO', 'Ещё идут'], right: ['YES', 'Да, закончились'],
    date: ['EARLIER', 'Закончились раньше'], isEnd: true,
  },
  PLANNED_START: {
    title: 'Месячные начались по плану?',
    left: ['NO', 'Нет, ещё нет'], right: ['YES', 'Да'],
    date: ['SHIFT', 'Сдвинуть дату'],
  },
  SHORT_INTERVAL: {
    title: 'Это новый цикл?',
    hint: 'Между двумя отметками начала меньше 15 дней.',
    left: ['MERGE', 'Продолжение'], right: ['SEPARATE', 'Новый цикл'],
  },
  AUTO_CLOSED: {
    title: 'Мы отметили окончание месячных',
    left: ['FIX_END', 'Исправить дату'], right: ['ACKNOWLEDGE', 'Всё верно'],
    isEnd: true,
  },
}
