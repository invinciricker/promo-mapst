/* =====================================================================================
   regles.js: the rules of the account, as plain functions (Phase 6).

   Nothing here touches the screen, the phone's storage or the internet, so each function
   can be tested on its own (tests/test_sync.mjs runs them with Node):
     pseudoOk, codeOk, codeTropFacile, codePromoOk   what may be typed
     fusionnerProgres                                the merge of the progress (sync)
     memesDonnees                                    are two progress objects the same?
     jourParis, semaineISO, joursDeLaSemaine, xpSemaine   the week of the classement
     scoreAEnvoyer                                   what the classement line may receive
   ===================================================================================== */

// -------------------------------------------------------------------------------------
// What may be typed
// -------------------------------------------------------------------------------------

/** A pseudo: 3 to 15 characters among a-z A-Z 0-9 - _ */
export const pseudoOk = (pseudo) => /^[A-Za-z0-9_-]{3,15}$/.test(String(pseudo || ""));

/** The code of an account: exactly 6 digits. */
export const codeOk = (code) => /^[0-9]{6}$/.test(String(code || ""));

/** The class code (a document name in « codes », checked by the database rules). */
export const codePromoOk = (code) => /^[A-Za-z0-9-]{4,20}$/.test(String(code || ""));

/**
 * The codes too easy to guess (refused before sending):
 *   six times the same digit (000000), a straight run up or down (123456, 654321,
 *   012345, 987654, also 890123), a pattern of 2 or 3 digits repeated (121212, 123123),
 *   a mirror (123321), and 112233, 111222.
 */
export function codeTropFacile(code) {
  const c = String(code || "");
  if (!codeOk(c)) return false;
  const d = [...c].map(Number);
  if (d.every((x) => x === d[0])) return true;
  const steps = d.slice(1).map((x, i) => (x - d[i] + 10) % 10);
  if (steps.every((s) => s === 1) || steps.every((s) => s === 9)) return true;
  if (c === c.slice(0, 2).repeat(3) || c === c.slice(0, 3).repeat(2)) return true;
  if (c === [...c].reverse().join("")) return true;
  return c === "112233" || c === "111222";
}

// -------------------------------------------------------------------------------------
// The merge of the progress (phone + online -> both), item by item, so nothing is lost
// -------------------------------------------------------------------------------------
const isMap = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const num = (value) => (Number.isFinite(value) ? value : 0);

/** Réviser's saved object (js/reviser/progress.js), always with every field. */
function reviserOf(value) {
  const r = isMap(value) && value.v === 1 ? value : {};
  return {
    v: 1,
    xp: num(r.xp),
    days: isMap(r.days) ? r.days : {},
    done: isMap(r.done) ? r.done : {},
    cards: isMap(r.cards) ? r.cards : {},
    runs: isMap(r.runs) ? r.runs : {},
    lastTheme: typeof r.lastTheme === "string" ? r.lastTheme : null,
  };
}

/** One lesson of Cours (js/cours/lecons.js): { at, read }. */
function lessonOf(value) {
  return isMap(value) ? value : {};
}

/** The further progress of one lesson: « lue » (read) wins, then the card reached. */
function laterLesson(a, b) {
  const ra = typeof a.read === "string" && a.read ? a.read : "";
  const rb = typeof b.read === "string" && b.read ? b.read : "";
  const at = Math.max(Number.isInteger(a.at) ? a.at : 0, Number.isInteger(b.at) ? b.at : 0);
  if (ra && !rb) return a;
  if (rb && !ra) return b;
  if (ra && rb) return { ...a, ...b, read: ra > rb ? ra : rb, at };
  return { ...a, ...b, at };
}

/**
 * Merges the progress of the phone and the one saved online.
 *   local, distant   { reviser, lecons } (either may be null: nothing saved)
 *   localT           when the phone's progress last changed (ms)
 *   distantT         when the online copy was saved (majLe, ms)
 * Returns { reviser, lecons }, the same for both sides:
 *   reviser.xp       the larger
 *   reviser.days     for each day, the entry with the larger xp
 *   reviser.done     for each question, the larger value (2 right the first time, 1 after)
 *   reviser.cards, .runs, .lastTheme   from the side saved last
 *   lecons           for each lesson, the further progress; « lue » wins
 */
export function fusionnerProgres(local, distant, { localT = 0, distantT = 0 } = {}) {
  const l = isMap(local) ? local : {};
  const d = isMap(distant) ? distant : {};
  const a = reviserOf(l.reviser);
  const b = reviserOf(d.reviser);
  const last = num(distantT) > num(localT) ? b : a;

  const days = {};
  for (const day of new Set([...Object.keys(a.days), ...Object.keys(b.days)])) {
    const x = isMap(a.days[day]) ? a.days[day] : null;
    const y = isMap(b.days[day]) ? b.days[day] : null;
    if (!x || !y) { days[day] = x || y; continue; }
    const better = num(y.xp) > num(x.xp) || (num(y.xp) === num(x.xp) && num(y.done) > num(x.done));
    days[day] = better ? y : x;
  }
  const done = {};
  for (const id of new Set([...Object.keys(a.done), ...Object.keys(b.done)])) {
    done[id] = Math.max(num(a.done[id]), num(b.done[id]));
  }
  const reviser = { v: 1, xp: Math.max(a.xp, b.xp), days, done, cards: last.cards, runs: last.runs, lastTheme: last.lastTheme };

  const la = isMap(l.lecons) ? l.lecons : {};
  const lb = isMap(d.lecons) ? d.lecons : {};
  const lecons = {};
  for (const id of new Set([...Object.keys(la), ...Object.keys(lb)])) {
    if (!(id in la)) lecons[id] = lessonOf(lb[id]);
    else if (!(id in lb)) lecons[id] = lessonOf(la[id]);
    else lecons[id] = laterLesson(lessonOf(la[id]), lessonOf(lb[id]));
  }
  return { reviser, lecons };
}

/** The same data, whatever the order of the keys? (to know if a merge changed something) */
export function memesDonnees(a, b) {
  return stable(a) === stable(b);
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (isMap(value)) {
    return `{${Object.keys(value).filter((k) => value[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

// -------------------------------------------------------------------------------------
// The week of the classement (ISO week, Monday first, Europe/Paris)
// -------------------------------------------------------------------------------------

/** The day in Nice: "2026-11-13", whatever the time zone of the phone. */
export function jourParis(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const utc = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const isoOf = (date) => date.toISOString().slice(0, 10);

/** « 2026-W46 »: the ISO week of a date (the week of its Thursday). */
export function semaineISO(date = new Date()) {
  const t = utc(jourParis(date));
  const weekday = t.getUTCDay() || 7;             // Monday 1 … Sunday 7
  t.setUTCDate(t.getUTCDate() + 4 - weekday);     // the Thursday of the week
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** The seven days of the week of a date, Monday first: ["2026-11-09", …, "2026-11-15"]. */
export function joursDeLaSemaine(date = new Date()) {
  const t = utc(jourParis(date));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() || 7) - 1));
  return Array.from({ length: 7 }, (_, i) => isoOf(new Date(t.getTime() + i * 86400000)));
}

/** XP of the week: the sum of reviser.days[day].xp for the days of the current week. */
export function xpSemaine(days, date = new Date()) {
  if (!isMap(days)) return 0;
  return joursDeLaSemaine(date).reduce((sum, day) => sum + (isMap(days[day]) ? Math.max(0, Math.floor(num(days[day].xp))) : 0), 0);
}

// -------------------------------------------------------------------------------------
// The classement line: what may be sent (the database rules refuse the rest)
// -------------------------------------------------------------------------------------
export const SCORE = {
  parEcriture: 400,         // never more than +400 per write
  nouvelleSemaine: 400,     // nor more than 400 on the first write of a new week
  premiereLigne: 3000,      // 3 000 on the very first line
  max: 20000,
};

/**
 * The XP to write on my classement line, or null to write nothing.
 *   reel    my real XP of the week
 *   semaine the current week (« 2026-W46 »)
 *   ligne   my line as it is online ({ semaine, xp }), or null if there is none
 * Never less than the last value of the same week; if the real number is higher than
 * allowed, the allowed maximum (the rest goes at the next sync). Nothing for 0 XP.
 */
export function scoreAEnvoyer({ reel, semaine, ligne }) {
  const xp = Math.max(0, Math.min(SCORE.max, Math.floor(num(reel))));
  if (!ligne) return xp > 0 ? Math.min(xp, SCORE.premiereLigne) : null;
  if (ligne.semaine === semaine) {
    const before = num(ligne.xp);
    return xp > before ? Math.min(xp, before + SCORE.parEcriture) : null;
  }
  if (String(semaine) > String(ligne.semaine)) return xp > 0 ? Math.min(xp, SCORE.nouvelleSemaine) : null;
  return null;                 // the line is of a later week (the phone's clock is late)
}
