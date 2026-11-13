/* =====================================================================================
   view-week.js: the « Semaine » view of the planning.
   One card per day (docs/design/prototype.html, block 6): « jeu. », the date, a label
   and two small bars for the morning and the afternoon; the chosen day is blue and
   raised. Then the chosen day's half-days as cards, and the notes of the week (citron
   banners). The arrows change the week; a tap on a card or a swipe on the list changes
   the day (planning.js).
   ===================================================================================== */

import { esc } from "../core/dom.js";
import { parseISO, toISO, addDays, startOfWeek, MONTHS, MONTHS_SHORT, DAYS, DAYS_SHORT } from "../core/dates.js";
import { personalOn } from "./personal.js";
import { dayListHTML, dayTitle } from "./parts.js";


/** « 9 – 15 novembre », or « 28 sept. – 4 oct. » across two months. */
export function weekTitle(mondayDate) {
  const sunday = addDays(mondayDate, 6);
  if (mondayDate.getMonth() === sunday.getMonth()) {
    return `${mondayDate.getDate()} – ${sunday.getDate()} ${MONTHS[sunday.getMonth()]}`;
  }
  return `${mondayDate.getDate()} ${MONTHS_SHORT[mondayDate.getMonth()]} – ${sunday.getDate()} ${MONTHS_SHORT[sunday.getMonth()]}`;
}

/** What a day card says under its date: its first half-day, or why there is none. */
function dayLabel(model, iso, date) {
  const day = model.day(iso);
  const first = day.slots.find((s) => !s.free) || day.slots[0];
  if (day.holiday) return "Férié";
  if (day.vacation) return "Vacances";
  if (first) return first.short || first.title;
  return date.getDay() === 0 || date.getDay() === 6 ? "Repos" : "Libre";
}

/** The two small bars of a day card: the morning and the afternoon, in their category colours. */
function halvesHTML(model, iso) {
  const day = model.day(iso);
  if (day.holiday || day.vacation) return "";
  const half = (id) => day.slots.find((s) => s.half === id);
  const am = half("am");
  const pm = half("pm");
  if (!am && !pm) return "";
  // One bar missing = that half is free (its place is kept, so the other one doesn't move).
  const bar = (slot) => (slot ? `<i class="cat-${esc(slot.cat)}"></i>` : `<i class="is-none"></i>`);
  return bar(am) + bar(pm);
}

/**
 * The strip of the 7 days of the week of `selectedIso`: one card per day, half on the
 * header. It slides sideways; the chosen day is brought to the middle (planning.js).
 */
export function weekStripHTML(model, selectedIso, now) {
  const monday = startOfWeek(parseISO(selectedIso));
  const todayIso = toISO(now);
  let cells = "";
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const iso = toISO(date);
    const classes = model.day(iso).slots.some((s) => !s.free);
    const count = model.day(iso).slots.filter((s) => !s.free).length + personalOn(iso).length;
    const cls = ["dcard", "tap", iso === selectedIso && "on", iso === todayIso && "is-today", !classes && "off"].filter(Boolean).join(" ");
    const label = `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}${iso === todayIso ? ", aujourd’hui" : ""}`
      + (classes ? `, ${count} ${count > 1 ? "demi-journées" : "demi-journée"}` : ", pas de formation");
    cells += `<button type="button" class="${cls}" data-select-day="${iso}" aria-pressed="${iso === selectedIso}" aria-label="${esc(label)}">
        <small aria-hidden="true">${DAYS_SHORT[date.getDay()]}</small><b aria-hidden="true">${date.getDate()}</b>
        <span class="dcard__label" aria-hidden="true">${esc(dayLabel(model, iso, date))}</span>
        <span class="halves" aria-hidden="true">${halvesHTML(model, iso)}</span>
      </button>`;
  }
  return `<div class="days rise" style="--i:0">${cells}</div>`;
}

/**
 * The notes of the planning (« checks ») that have a date, shown in their week as a slim
 * citron banner. A note that starts a stage of the year (a correction: « Du 2 au
 * 20 novembre ») shows in every week of that stage.
 */
export function weekBannersHTML(model, selectedIso) {
  const monday = toISO(startOfWeek(parseISO(selectedIso)));
  const sunday = toISO(addDays(parseISO(monday), 6));
  return model.checks.filter((c) => c.date).filter((c) => {
    const stage = model.stages.find((s) => s.start === c.date);
    const end = stage ? stage.end : c.date;
    return c.date <= sunday && end >= monday;          // the note's days meet this week
  }).map((c) => `<div class="banner tone-citron pl-banner"><svg class="icon" aria-hidden="true"><use href="#i-info"/></svg>
      <span><b>${esc(c.title)}</b> : ${esc(c.text.replace(/^./, (x) => x.toLowerCase()))}</span></div>`).join("");
}

/** Everything of the Semaine view, under the header: the day cards, the chosen day, the notes. */
export function weekViewHTML(model, selectedIso, now) {
  const isToday = selectedIso === toISO(now);
  const title = dayTitle(selectedIso);
  return `${weekStripHTML(model, selectedIso, now)}
    <h2 class="section-title dayhead rise" style="--i:1">${isToday ? `Aujourd’hui <small>${esc(title.toLowerCase())}</small>` : esc(title)}</h2>
    <div class="pl-daylist rise" style="--i:2" data-swipe="day">${dayListHTML(model, selectedIso, now)}</div>
    <div class="pl-banners rise" style="--i:3">${weekBannersHTML(model, selectedIso)}</div>`;
}
