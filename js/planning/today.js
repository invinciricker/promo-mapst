/* =====================================================================================
   today.js: what the « Aujourd'hui » card of Accueil says (js/screens/accueil.js).

   One of these, decided from the planning and the time:
     "now"     a half-day is on now: it, with a progress bar and « encore 1 h 20 »,
               then the next one (« Ensuite »)
     "next"    a class day, nothing on right now: the next half-day today, then the one after
     "done"    today's classes are over: « Fini pour aujourd'hui », then the next half-day
     "off"     no class today: « Week-end », the holiday or the day off, then the next
               half-day with its date
   Plus today's personal events, and the next épreuve or dossier if it is due within
   14 days (with its J-x).
   ===================================================================================== */

import { at, addDays, toISO, parseISO, daysBetween, capitalize, longDate } from "../core/dates.js";
import { personalOn } from "./personal.js";
import { itemEnd } from "./parts.js";

const LOOK_AHEAD = 120;          // days searched for the next half-day
const DEADLINE_DAYS = 14;        // an épreuve or a dossier closer than this is shown

/** The class half-days (not the free ones) from a day on, as { item, iso, start, end }. */
function classesFrom(model, fromDate, days) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const iso = toISO(addDays(fromDate, i));
    for (const item of model.day(iso).slots) {
      if (item.free || !item.start) continue;
      out.push({ item, iso, start: at(iso, item.start), end: at(iso, itemEnd(item)) });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** « Demain », « Lundi 9 novembre » (or « Aujourd’hui »). */
export function dayLabel(iso, now) {
  const days = daysBetween(now, parseISO(iso));
  if (days === 0) return "Aujourd’hui";
  if (days === 1) return "Demain";
  return capitalize(longDate(parseISO(iso)));
}

/**
 * Everything the card needs:
 *   { kind, current, next, after, off: { icon, tone, title, text }, personal, deadline }
 *   current, next, after: { item, iso, start, end } or null
 *   deadline: { k (the key date), days } or null
 */
export function todayStatus(model, now = new Date()) {
  const todayIso = toISO(now);
  const day = model.day(todayIso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcoming = classesFrom(model, today, LOOK_AHEAD);
  const todays = upcoming.filter((x) => x.iso === todayIso);

  const current = todays.find((x) => now >= x.start && now < x.end) || null;
  const later = upcoming.filter((x) => x.start > now);
  const nextToday = later.find((x) => x.iso === todayIso) || null;
  const nextAny = later[0] || null;

  let kind;
  let off = null;
  let next;
  let after = null;
  if (current) {
    kind = "now";
    next = null;
    after = later[0] || null;
  } else if (nextToday) {
    kind = "next";
    next = nextToday;
    after = later[1] || null;
  } else if (todays.length) {
    kind = "done";
    next = nextAny;
    off = { icon: "moon", tone: "azur", title: "Fini pour aujourd’hui",
      text: now.getHours() >= 17 ? "Bonne soirée !" : "Bonne fin de journée !" };
  } else {
    kind = "off";
    next = nextAny;
    const weekend = now.getDay() === 0 || now.getDay() === 6;
    if (now < model.seasonStart) {
      off = { icon: "sun", tone: "galet", title: "Bientôt la rentrée", text: `La formation commence le ${longDate(model.seasonStart)}.` };
    } else if (!nextAny && now > model.seasonEnd) {
      off = { icon: "sun", tone: "galet", title: "Formation terminée", text: "Bravo, et bonne suite !" };
    } else if (day.holiday) {
      off = { icon: "sun", tone: "galet", title: day.holiday, text: "Jour férié, pas de formation" };
    } else if (day.vacation) {
      off = { icon: "sun", tone: "galet", title: day.vacation, text: "Pas de formation aujourd’hui" };
    } else if (weekend) {
      off = { icon: "sun", tone: "galet", title: "Week-end", text: "Pas de formation aujourd’hui" };
    } else {
      off = { icon: "sun", tone: "galet", title: "Pas de formation", text: "Rien de prévu aujourd’hui" };
    }
  }

  // The next épreuve or dossier, if it is close.
  const due = model.upcomingDeadlines(todayIso, 1)[0] || null;
  const dueDays = due ? daysBetween(today, parseISO(due.date)) : null;
  const deadline = due && dueDays >= 0 && dueDays <= DEADLINE_DAYS ? { k: due, days: dueDays } : null;

  return { kind, current, next, after, off, personal: personalOn(todayIso), deadline };
}
