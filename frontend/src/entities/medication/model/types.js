/**
 * @typedef {1|2|3} Effectiveness  — 1 не помогло, 2 частично, 3 помогло
 *
 * @typedef {Object} Medication
 * @property {string}            id
 * @property {string}            date        — 'YYYY-MM-DD'
 * @property {string}            time        — 'HH:MM'
 * @property {string}            name        — название препарата
 * @property {string}            dosage      — дозировка, произвольная строка ('400 мг')
 * @property {string|null}       attackId    — id связанного приступа или null
 * @property {Effectiveness|null} effectiveness — оценка эффекта, null если не оценено
 * @property {string}            note
 * @property {string}            createdAt   — ISO timestamp
 */
