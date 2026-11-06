/* =====================================================================================
   progress.js: what Réviser remembers, saved on the phone only (localStorage key
   "promo-mapst:reviser"). Nothing is sent anywhere. From Phase 4 it will also be synced
   with the account.

   What is saved:
     xp        all the XP won so far
     days      for each day with activity: the XP won and the sessions finished
               (used for the « série »: the number of days in a row with at least one
               lesson or one review finished)
     lessons   for each lesson: finished or not, how many times, best score
     cards     the questions answered wrong, for « Mes erreurs » (see below)
     lastTheme the theme played last, so « Continuer » goes back to it

   « Mes erreurs » works like flash cards in boxes:
     - a wrong answer puts the question in box 0: it can be reviewed straight away;
     - each right answer in a review moves it up one box, and it comes back later:
       box 1 the next day, box 2 three days later, box 3 a week later;
     - right once more after that: the question is known, it leaves « Mes erreurs ».
   ===================================================================================== */

import { load, save, remove } from "../core/storage.js";
import { toISO, parseISO, addDays, daysBetween } from "../core/dates.js";

const KEY = "reviser";
const INTERVALS = [0, 1, 3, 7];          // days before the question comes back, per box
const KNOWN = INTERVALS.length;           // box reached = the question is known
const KEEP_DAYS = 400;                    // older days are forgotten (the year is shorter)

/** XP won (see CLAUDE.md « État » for the reasons of these numbers). */
export const XP = {
  firstTry: 10,       // right the first time, in a lesson
  corrected: 5,       // right on the second try (the question comes back at the end)
  perfect: 10,        // bonus: a lesson with no mistake at all
  review: 5,          // right answer in « Mes erreurs »
};

const today = () => toISO(new Date());
const blank = () => ({ v: 1, xp: 0, days: {}, lessons: {}, cards: {}, lastTheme: null });

let state = null;

function read() {
  if (!state) {
    const saved = load(KEY, null);
    state = saved && saved.v === 1 ? { ...blank(), ...saved } : blank();
  }
  return state;
}

function write() {
  // Forget the days that are too old, so the saved data stays small.
  const limit = toISO(addDays(new Date(), -KEEP_DAYS));
  for (const day of Object.keys(state.days)) if (day < limit) delete state.days[day];
  save(KEY, state);
}

// -------------------------------------------------------------------------------------
// Reading
// -------------------------------------------------------------------------------------

/** Total XP, and XP won today. */
export function xpTotal() { return read().xp; }
export function xpToday() { return (read().days[today()] || {}).xp || 0; }

/**
 * The « série »: days in a row with at least one lesson or review finished.
 *   count     the number of days
 *   doneToday true if today already counts
 *   atRisk    true if the série is alive but needs a session today to continue
 */
export function streak() {
  const days = read().days;
  const active = (iso) => Boolean(days[iso] && days[iso].done > 0);
  const now = new Date();
  const doneToday = active(toISO(now));
  let cursor = doneToday ? now : addDays(now, -1);
  let count = 0;
  while (active(toISO(cursor))) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return { count, doneToday, atRisk: count > 0 && !doneToday };
}

/** { done, count, best } for a lesson (best = best share of right answers, 0 to 100). */
export function lessonInfo(key) {
  const info = read().lessons[key];
  return { done: Boolean(info && info.done), count: (info && info.count) || 0, best: (info && info.best) || 0 };
}

/** A lesson can be played if it is the first of its theme or if the one before is done. */
export function isUnlocked(theme, lesson) {
  const position = theme.lessons.indexOf(lesson);
  return position <= 0 || lessonInfo(theme.lessons[position - 1].key).done;
}

/** { done, total } lessons finished in a theme. */
export function themeProgress(theme) {
  const done = theme.lessons.filter((l) => lessonInfo(l.key).done).length;
  return { done, total: theme.lessons.length };
}

/** The lesson « Continuer » should open: in the last theme played first, else the first one left. */
export function nextLesson(content) {
  const firstOpen = (theme) => theme.lessons.find((l) => !lessonInfo(l.key).done && isUnlocked(theme, l));
  const last = content.theme(read().lastTheme);
  if (last && firstOpen(last)) return { theme: last, lesson: firstOpen(last) };
  for (const theme of content.themes) {
    const lesson = firstOpen(theme);
    if (lesson) return { theme, lesson };
  }
  return null;
}

/** Questions of « Mes erreurs »: all of them, and the ones to review today. */
export function mistakes(content) {
  const cards = read().cards;
  const now = today();
  const all = Object.keys(cards)
    .map((id) => ({ q: content.question(id), card: cards[id] }))
    .filter((x) => x.q);                                   // a removed question is ignored
  const due = all.filter((x) => x.card.due <= now)
    .sort((a, b) => (a.card.due < b.card.due ? -1 : a.card.due > b.card.due ? 1 : b.card.wrong - a.card.wrong));
  const next = all.filter((x) => x.card.due > now).map((x) => x.card.due).sort()[0] || null;
  return { all: all.length, due: due.map((x) => x.q), nextDue: next };
}

/** Number of days until a date, for « dans 2 jours ». */
export function daysUntil(iso) {
  return daysBetween(parseISO(today()), parseISO(iso));
}

// -------------------------------------------------------------------------------------
// Saving
// -------------------------------------------------------------------------------------

/**
 * Called after each answer, so a mistake is remembered even if the lesson is left.
 *   firstTry  false when the question comes back at the end of a lesson
 *   review    true in « Mes erreurs »
 */
export function recordAnswer(questionId, right, { firstTry = true, review = false } = {}) {
  const s = read();
  const card = s.cards[questionId];
  if (!right) {
    s.cards[questionId] = { box: 0, due: today(), wrong: ((card && card.wrong) || 0) + 1 };
  } else if (card && (review || firstTry) && card.due <= today()) {
    const box = card.box + 1;
    if (box >= KNOWN) delete s.cards[questionId];          // known now: out of « Mes erreurs »
    else s.cards[questionId] = { ...card, box, due: toISO(addDays(new Date(), INTERVALS[box])) };
  }
  write();
}

/**
 * Called when a lesson or a review is finished (not when it is left or lost).
 *   result: { kind: "lesson" | "review", lessonKey, themeId, xp, total, firstTryRight }
 * Returns what the end screen shows: { xp, xpTotal, streak, streakGrew }.
 */
export function finishSession(result) {
  const s = read();
  const before = streak();
  const day = today();
  const entry = s.days[day] || { xp: 0, done: 0 };
  entry.xp += result.xp;
  entry.done += 1;
  s.days[day] = entry;
  s.xp += result.xp;

  if (result.kind === "lesson" && result.lessonKey) {
    const previous = s.lessons[result.lessonKey] || { done: false, count: 0, best: 0 };
    const score = result.total ? Math.round((100 * result.firstTryRight) / result.total) : 0;
    s.lessons[result.lessonKey] = { done: true, count: previous.count + 1, best: Math.max(previous.best, score), last: day };
  }
  if (result.themeId) s.lastTheme = result.themeId;
  write();

  const after = streak();
  return { xp: result.xp, xpTotal: s.xp, streak: after.count, streakGrew: !before.doneToday };
}

/** Erases everything Réviser saved on this phone (button in Infos). */
export function resetProgress() {
  state = blank();
  remove(KEY);
}

/** Is there any progress at all? (to show or hide the reset button) */
export function hasProgress() {
  const s = read();
  return s.xp > 0 || Object.keys(s.cards).length > 0 || Object.keys(s.lessons).length > 0;
}
