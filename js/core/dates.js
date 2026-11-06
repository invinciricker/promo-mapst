/* =====================================================================================
   dates.js: everything about dates and hours, in French.

   Dates are written "YYYY-MM-DD" in the data (for example "2026-11-06"): we call that
   an "iso" date. Hours are written "HH:MM" ("09:30").
   ===================================================================================== */

export const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export const DAYS_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
export const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
  "septembre", "octobre", "novembre", "décembre"];
export const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août",
  "sept.", "oct.", "nov.", "déc."];

const pad = (n) => String(n).padStart(2, "0");

/** "2026-11-06" -> a Date at midnight (local time) */
export function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** a Date -> "2026-11-06" */
export function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

/** The Monday of the week of a date (weeks start on Monday in France). */
export function startOfWeek(date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Number of days from a to b (b - a), ignoring the hours. */
export function daysBetween(a, b) {
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / 86400000);
}

/** "09:30" -> 570 (minutes after midnight) */
export function minutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** The exact moment: day "2026-11-06" at "09:30" */
export function at(iso, hhmm) {
  const d = parseISO(iso);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/** "09:30" -> "9h30", "13:00" -> "13h" (how French timetables write hours) */
export function hour(hhmm) {
  const [h, m] = hhmm.split(":");
  return `${Number(h)}h${m === "00" ? "" : m}`;
}

/** 80 -> "1 h 20", 35 -> "35 min" */
export function duration(totalMinutes) {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${pad(r)}` : `${h} h`;
}

export const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** "vendredi 6 novembre" */
export function longDate(date) {
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "ven. 6 nov." */
export function shortDate(date) {
  return `${DAYS_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "6 nov." */
export function dayMonth(date) {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "1er" for the first day of a month, the number otherwise. */
export function dayNumber(date) {
  return date.getDate() === 1 ? "1er" : String(date.getDate());
}

/** Countdown to a date: "Aujourd’hui", "Demain", "J-12" */
export function countdown(daysLeft) {
  if (daysLeft === 0) return "Aujourd’hui";
  if (daysLeft === 1) return "Demain";
  if (daysLeft > 1) return `J-${daysLeft}`;
  return "Passé";
}

/** Is iso between start and end (both included)? Works on "YYYY-MM-DD" texts. */
export function isBetween(iso, start, end) {
  return iso >= start && iso <= end;
}
