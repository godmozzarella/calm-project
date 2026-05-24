/**
 * @typedef {'pulsating' | 'pressing' | 'stabbing' | 'bursting'} AttackType
 * @typedef {'nausea' | 'light' | 'sound' | 'aura' | 'dizziness'} Symptom
 * @typedef {'stress' | 'sleep' | 'food' | 'weather' | 'screen' | 'hormones' | 'alcohol'} Trigger
 *
 * @typedef {Object} Attack
 * @property {string}       id          — UUID
 * @property {string}       startDate   — 'YYYY-MM-DD'
 * @property {string}       startTime   — 'HH:MM'
 * @property {string|null}  endDate     — 'YYYY-MM-DD', null если ongoing
 * @property {string|null}  endTime     — 'HH:MM', null если нет или ongoing
 * @property {boolean}      ongoing     — приступ ещё продолжается
 * @property {number}       intensity   — 1–10
 * @property {AttackType}   type
 * @property {Symptom[]}    symptoms
 * @property {Trigger[]}    triggers
 * @property {string}       note
 * @property {string}       createdAt   — ISO timestamp записи
 */
