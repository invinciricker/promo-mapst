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
     runs      the lessons started and left before the end, to « Continuer » them later
               (by lesson, with the ids of the questions already answered right; ids that
               are no longer in the lesson are ignored)
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
const blank = () => ({ v: 1, xp: 0, days: {}, done: {}, cards: {}, runs: {}, lastTheme: null });
const isMap = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

let state = null;

function read() {
  if (!state) {
    const saved = load(KEY, null);
    state = blank();
    if (isMap(saved) && saved.v === 1) {
      if (Number.isFinite(saved.xp) && saved.xp > 0) state.xp = Math.round(saved.xp);
      for (const field of ["days", "done", "cards", "runs"]) if (isMap(saved[field])) state[field] = saved[field];
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
 * A lesson started and left before the end (null if none): what was already done.
 *   right   ids answered right in this run        first   the ones right the first time
 *   missed  ids answered wrong, not right yet      lives, xp, mistakes   as when it was left
 */
export function lessonRun(lesson) {
  const run = read().runs[lesson.key];
  if (!isMap(run)) return null;
  const ids = new Set(lesson.questions.map((q) => q.id));
  const keep = (list) => (Array.isArray(list) ? [...new Set(list)].filter((id) => ids.has(id)) : []);
  const right = keep(run.right);
  const missed = keep(run.missed).filter((id) => !right.includes(id));
  if (!right.length && !missed.length) return null;
  const lives = Number.isInteger(run.lives) ? Math.min(3, Math.max(1, run.lives)) : 3;
  return {
    right,
    first: keep(run.first).filter((id) => right.includes(id)),
    missed,
    lives,
    xp: Number.isFinite(run.xp) && run.xp > 0 ? Math.round(run.xp) : 0,
    mistakes: Number.isInteger(run.mistakes) && run.mistakes > 0 ? run.mistakes : 0,
  };
}

/** Saves where a lesson stands, after each answer (so it can be continued later). */
export function saveRun(lesson, run) {
  read().lastTheme = lesson.theme;
  state.runs[lesson.key] = {
    right: run.right, first: run.first, missed: run.missed,
    lives: run.lives, xp: run.xp, mistakes: run.mistakes, day: today(),
  };
  write();
}

/** The lesson is finished, or lost (all the lives): the next time starts from the beginning. */
export function clearRun(lesson) {
  if (!read().runs[lesson.key]) return;
  delete state.runs[lesson.key];
  write();
}

/**
 * What the ring of a lesson shows: { answered, total, verb }
 *   verb « Commencer » (nothing yet), « Continuer » (started, or new questions),
 *   « Refaire » (finished).
 */
export function lessonRing(lesson) {
  const info = lessonInfo(lesson);
  const run = lessonRun(lesson);
  if (run) return { answered: run.right.length, total: info.total, verb: "Continuer", run };
  if (info.complete) return { answered: info.total, total: info.total, verb: "Refaire", run: null };
  if (info.started) return { answered: info.done, total: info.total, verb: "Continuer", run: null };
  return { answered: 0, total: info.total, verb: "Commencer", run: null };
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

/**
 * Where a theme stands: { done, total, share, started, answered, questions }
 *   done, total  lessons « terminées », and all its lessons
 *   answered, questions   its questions answered right, and all of them (« Quiz 7/10 » in Cours)
 *   share        the share of its questions answered right (lessons left in the middle count)
 *   started      at least one question answered
 */
export function themeProgress(theme) {
  const doneMap = read().done;
  let questions = 0;
  let answered = 0;
  let complete = 0;
  for (const lesson of theme.lessons) {
    const run = lessonRun(lesson);
    const inRun = new Set(run ? run.right : []);
    questions += lesson.questions.length;
    answered += lesson.questions.filter((q) => doneMap[q.id] || inRun.has(q.id)).length;
    if (lessonInfo(lesson).complete) complete++;
  }
  return {
    done: complete,
    total: theme.lessons.length,
    answered,
    questions,
    share: questions ? answered / questions : 0,
    started: answered > 0,
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
 *   result: { kind: "lesson" | "review", themeId, lessonKey, xp, questionIds, firstTryIds }
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
  if (result.lessonKey) delete s.runs[result.lessonKey];
  write();

  const after = streak();
  return { xp: result.xp, xpTotal: s.xp, streak: after.count, streakGrew: !before.doneToday };
}

/** Erases everything Réviser saved on this phone (Profil › Ce que l’appli garde). */
export function resetProgress() {
  state = blank();
  remove(KEY);
}

/** Is there any progress at all? (to show or hide the reset button) */
export function hasProgress() {
  const s = read();
  return s.xp > 0 || Object.keys(s.cards).length > 0 || Object.keys(s.done).length > 0 || Object.keys(s.runs).length > 0;
}
