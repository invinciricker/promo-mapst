/* =====================================================================================
   model.js: turns content/planning.json into an object that is easy to use in the views.

   Vocabulary:
     slot      a half-day of the class planning (morning "am" or afternoon "pm")
     key date  an important date: épreuve, dossier deadline, public holiday, step
     stage     a period of the year ("MSP 2 au centre", "Pleine nature"...)
     category  cours, prepa, centre, epreuve, libre, perso (colours named after Nice)
   ===================================================================================== */

import { parseISO, toISO, addDays, startOfWeek, minutes, isBetween } from "../core/dates.js";
import { plain } from "../core/dom.js";

/**
 * @param data        content of content/planning.json
 * @param themes      content of content/themes.json (Réviser / Étudier themes)
 * @param themeLinks  content of content/planning-themes.json (keywords -> theme)
 */
export function createPlanning(data, themes = [], themeLinks = []) {
  const days = data.days || {};
  const categories = new Map((data.categories || []).map((c) => [c.id, c]));
  const weekByMonday = new Map((data.weeks || []).map((w) => [w.monday, w.number]));
  const totalWeeks = Math.max(0, ...(data.weeks || []).map((w) => w.number));
  const stages = data.stages || [];
  const keyDates = (data.keyDates || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const school = data.schoolHolidays || [];

  // The season, and the months the app shows (September -> June).
  const seasonStart = parseISO(data.season.start);
  const seasonEnd = parseISO(data.season.end);
  const firstDay = new Date(seasonStart.getFullYear(), seasonStart.getMonth(), 1);
  const lastDay = new Date(seasonEnd.getFullYear(), seasonEnd.getMonth() + 1, 0);

  // Each slot gets an id ("2026-11-06-am") and its date.
  const slotsByDay = new Map();
  for (const [iso, day] of Object.entries(days)) {
    slotsByDay.set(iso, (day.slots || []).map((s) => ({ ...s, id: `${iso}-${s.half}`, iso, kind: "class" })));
  }

  // Theme links: a slot is linked to a theme when its title contains one of the keywords.
  const themeById = new Map(themes.map((t) => [t.id, t]));
  const links = themeLinks
    .filter((link) => themeById.has(link.theme))
    .map((link) => ({
      theme: themeById.get(link.theme),
      patterns: (link.keywords || []).map((k) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(plain(k))}($|[^a-z0-9])`)),
    }));

  const model = {
    data,
    source: data.source || {},
    checks: data.checks || [],
    categories,
    stages,
    keyDates,
    totalWeeks,
    seasonStart,
    seasonEnd,
    firstDay,
    lastDay,

    category(id) {
      return categories.get(id) || { id, name: id, label: id, desc: "" };
    },

    /** Everything about one day. */
    day(iso) {
      const raw = days[iso] || {};
      return {
        iso,
        slots: slotsByDay.get(iso) || [],
        holiday: raw.holiday || null,          // public holiday ("Armistice")
        vacation: raw.vacation || null,        // no training ("Vacances de Noël")
        school: model.schoolHolidayOn(iso),    // school holidays, zone B
        keyDates: model.keyDatesOn(iso),
        week: model.weekNumber(iso),
        stage: model.stageOn(iso),
      };
    },

    /** A half-day from its id ("2026-11-06-am"). */
    slotById(id) {
      return (slotsByDay.get(String(id).slice(0, 10)) || []).find((s) => s.id === id) || null;
    },

    /** Is the day off (public holiday or holidays)? */
    isOff(iso) {
      const raw = days[iso];
      return Boolean(raw && (raw.holiday || raw.vacation));
    },

    /** Training week number (1 to 36), or null. */
    weekNumber(iso) {
      return weekByMonday.get(toISO(startOfWeek(parseISO(iso)))) || null;
    },

    stageOn(iso) {
      return stages.find((s) => isBetween(iso, s.start, s.end)) || null;
    },

    schoolHolidayOn(iso) {
      return school.find((h) => isBetween(iso, h.start, h.end)) || null;
    },

    /** Key dates that fall on this day (or cover it, for periods). */
    keyDatesOn(iso) {
      return keyDates.filter((k) => isBetween(iso, k.date, k.end || k.date));
    },

    /** Épreuves and dossier deadlines from a date on. */
    upcomingDeadlines(fromIso, limit = 99) {
      return keyDates
        .filter((k) => (k.kind === "epreuve" || k.kind === "dossier") && (k.end || k.date) >= fromIso)
        .slice(0, limit);
    },

    /**
     * Main activity of a day, for the colour of its pebble.
     * personalCount: number of personal events that day (used when there is no class).
     */
    mainCategory(iso, personalCount = 0) {
      if (model.isOff(iso)) return "libre";
      const minutesBy = {};
      let hasFree = false;
      for (const s of slotsByDay.get(iso) || []) {
        if (s.free) { hasFree = true; continue; }
        minutesBy[s.cat] = (minutesBy[s.cat] || 0) + minutes(s.end) - minutes(s.start);
      }
      const best = Object.keys(minutesBy).sort((a, b) => minutesBy[b] - minutesBy[a])[0];
      if (best) return best;
      if (personalCount) return "perso";
      return hasFree ? "libre" : null;
    },

    /** Minutes of class in a day (free half-days not counted). */
    classMinutes(iso) {
      return (slotsByDay.get(iso) || [])
        .filter((s) => !s.free)
        .reduce((sum, s) => sum + minutes(s.end) - minutes(s.start), 0);
    },

    /** Réviser / Étudier themes that match a slot. */
    themesFor(slot) {
      const text = plain([slot.planning, slot.title, slot.short].filter(Boolean).join(" "));
      return links.filter((l) => l.patterns.some((p) => p.test(text))).map((l) => l.theme)
        .filter((theme, i, all) => all.indexOf(theme) === i);
    },

    /** All class slots with a time, between two dates (for the « En ce moment » card). */
    slotsBetween(fromDate, toDate) {
      const out = [];
      for (let d = fromDate; d <= toDate; d = addDays(d, 1)) {
        const iso = toISO(d);
        for (const s of slotsByDay.get(iso) || []) out.push(s);
      }
      return out;
    },

    /** Is this date inside the months the app shows? */
    inRange(date) {
      return date >= firstDay && date <= lastDay;
    },

    clamp(date) {
      if (date < firstDay) return firstDay;
      if (date > lastDay) return lastDay;
      return date;
    },
  };
  return model;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
