/* =====================================================================================
   progress.js: what Réviser remembers, saved on the phone only (localStorage key
   "promo-mapst:reviser"). Nothing is sent anywhere. From Phase 4 it will also be synced
   with the account.

   Everything is saved by question id (« anat-1-04 »), never by lesson number or by
   position: ids never change, so the progress survives when questions are added,
   moved to another lesson or removed (an id that no longer exists is simply ignored).

   What is saved:
     xp        all the XP won so far
     days      for each day with activity: the XP won and the sessions finished
               (used for the « série »: the number of days in a row with at least one
               lesson or one review finished)
     done      the questions answered right in a finished lesson:
               2 = right the first time, 1 = right after a mistake (the best result is kept)
     cards     the questions answered wrong, for « Mes erreurs » (see below)
     lastTheme the theme played last, so « Continuer » goes back to it

   A lesson is « terminée » when all its questions are in "done". If new questions are
   added to it later, it shows « Nouvelles questions », and the next lesson stays open.

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

/** XP won (also explained in « Comment ça marche »). */
export const XP = {
  firstTry: 10,       // right the first time, in a lesson
  corrected: 5,       // right on the second try (the question comes back at the end)
  perfect: 10,        // bonus: a lesson with no mistake at all
  review: 5,          // right answer in « Mes erreurs »
};

const today = () => toISO(new Date());
const blank = () => ({ v: 1, xp: 0, days: {}, done: {}, cards: {}, lastTheme: null });
const isMap = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

let state = null;

function read() {
  if (!state) {
    const saved = load(KEY, null);
    state = blank();
    if (isMap(saved) && saved.v === 1) {
      if (Number.isFinite(saved.xp) && saved.xp > 0) state.xp = Math.round(saved.xp);
      for (const field of ["days", "done", "cards"]) if (isMap(saved[field])) state[field] = saved[field];
      if (typeof saved.lastTheme === "string") state.lastTheme = saved.lastTheme;
    }
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

/**
 * Where a lesson stands, from its questions:
 *   total, done    its questions, and how many were answered right in a finished lesson
 *   complete       all of them: the lesson is « terminée »
 *   started        at least one: the lesson was finished before (it opens the next one)
 *   fresh          questions added since (complete is false, started is true)
 *   score          share of questions right the first time, 0 to 100 (best result)
 */
export function lessonInfo(lesson) {
  const done = read().done;
  const total = lesson.questions.length;
  const answered = lesson.questions.filter((q) => done[q.id]).length;
  const firstTry = lesson.questions.filter((q) => done[q.id] === 2).length;
  return {
    total,
    done: answered,
    complete: total > 0 && answered === total,
    started: answered > 0,
    fresh: answered > 0 ? total - answered : 0,
    score: total ? Math.round((100 * firstTry) / total) : 0,
  };
}

/**
 * A lesson can be played if it is the first of its theme, if the one before was
 * finished, or in « Mode relecture » (every lesson is open there).
 */
export function isUnlocked(theme, lesson, relecture = false) {
  if (relecture) return true;
  const position = theme.lessons.indexOf(lesson);
  return position <= 0 || lessonInfo(theme.lessons[position - 1]).started;
}

/** { done, total, share }: lessons « terminées » in a theme, and the share of its questions done. */
export function themeProgress(theme) {
  const infos = theme.lessons.map(lessonInfo);
  const questions = infos.reduce((sum, info) => sum + info.total, 0);
  const answered = infos.reduce((sum, info) => sum + info.done, 0);
  return {
    done: infos.filter((info) => info.complete).length,
    total: theme.lessons.length,
    share: questions ? answered / questions : 0,
  };
}

/** The first lesson of a theme still to do (open and not « terminée »), or null. */
export function currentLesson(theme, relecture = false) {
  return theme.lessons.find((l) => !lessonInfo(l).complete && isUnlocked(theme, l, relecture)) || null;
}

/** The lesson « Continuer » should open: in the last theme played first, else the first one left. */
export function nextLesson(content) {
  const last = content.theme(read().lastTheme);
  const fromLast = last && currentLesson(last, content.relecture);
  if (fromLast) return { theme: last, lesson: fromLast };
  for (const theme of content.themes) {
    const lesson = currentLesson(theme, content.relecture);
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
    .filter((x) => x.q && isMap(x.card));                  // a question not shown is ignored
  const due = all.filter((x) => x.card.due <= now)
    .sort((a, b) => (a.card.due < b.card.due ? -1 : a.card.due > b.card.due ? 1 : (b.card.wrong || 0) - (a.card.wrong || 0)));
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
    const box = (card.box || 0) + 1;
    if (box >= KNOWN) delete s.cards[questionId];          // known now: out of « Mes erreurs »
    else s.cards[questionId] = { ...card, box, due: toISO(addDays(new Date(), INTERVALS[box])) };
  }
  write();
}

/**
 * Called when a lesson or a review is finished (not when it is left or lost).
 *   result: { kind: "lesson" | "review", themeId, xp, questionIds, firstTryIds }
 *     questionIds  the questions of the lesson (all answered right by now)
 *     firstTryIds  the ones answered right the first time
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

  if (result.kind === "lesson") {
    const firstTry = new Set(result.firstTryIds || []);
    for (const id of result.questionIds || []) {
      s.done[id] = Math.max(s.done[id] || 0, firstTry.has(id) ? 2 : 1);
    }
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
  return s.xp > 0 || Object.keys(s.cards).length > 0 || Object.keys(s.done).length > 0;
}
