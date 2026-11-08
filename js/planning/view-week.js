/* =====================================================================================
   view-week.js: the « Semaine » view of the planning.
   A strip of the 7 days (a dot per half-day in its category colour, the chosen day
   filled in azur), the notes of the week (citron banners), then the chosen day's
   half-days. Arrows or a swipe on the strip change the week; a swipe on the list
   changes the day (planning.js).
   ===================================================================================== */

import { esc } from "../core/dom.js";
import { parseISO, toISO, addDays, startOfWeek, MONTHS, MONTHS_SHORT, DAYS } from "../core/dates.js";
import { personalOn } from "./personal.js";
import { dayListHTML, dayTitle } from "./parts.js";

const LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

/** « 9 – 15 novembre », or « 28 sept. – 4 oct. » across two months. */
export function weekTitle(mondayDate) {
  const sunday = addDays(mondayDate, 6);
  if (mondayDate.getMonth() === sunday.getMonth()) {
    return `${mondayDate.getDate()} – ${sunday.getDate()} ${MONTHS[sunday.getMonth()]}`;
  }
  return `${mondayDate.getDate()} ${MONTHS_SHORT[mondayDate.getMonth()]} – ${sunday.getDate()} ${MONTHS_SHORT[sunday.getMonth()]}`;
}

/** The coloured dots of a day: one per half-day (and per personal event). */
function dotsOf(model, iso) {
  const day = model.day(iso);
  const cats = day.slots.map((s) => s.cat);
  if (!cats.length && (day.holiday || day.vacation)) cats.push("libre");
  personalOn(iso).forEach(() => cats.push("perso"));
  return cats.slice(0, 4);
}

/** The strip of the 7 days of the week of `selectedIso`. */
export function weekStripHTML(model, selectedIso, now) {
  const monday = startOfWeek(parseISO(selectedIso));
  const todayIso = toISO(now);
  let cells = "";
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const iso = toISO(date);
    const dots = dotsOf(model, iso);
    const classes = model.day(iso).slots.some((s) => !s.free);
    const cls = ["wk-day", iso === selectedIso && "is-on", iso === todayIso && "is-today", !classes && "is-off"].filter(Boolean).join(" ");
    const label = `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}${iso === todayIso ? ", aujourd’hui" : ""}`
      + (classes ? `, ${dots.length} ${dots.length > 1 ? "demi-journées" : "demi-journée"}` : ", pas de formation");
    cells += `<button type="button" class="${cls}" data-select-day="${iso}" aria-pressed="${iso === selectedIso}" aria-label="${esc(label)}">
        <small aria-hidden="true">${LETTERS[i]}</small><b aria-hidden="true">${date.getDate()}</b>
        <span class="dots" aria-hidden="true">${dots.map((c) => `<i class="cat-${esc(c)}"></i>`).join("")}</span>
      </button>`;
  }
  return `<div class="card wk-strip" data-swipe="week">${cells}</div>`;
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

/** Everything of the Semaine view under the week title. */
export function weekViewHTML(model, selectedIso, now) {
  const isToday = selectedIso === toISO(now);
  return `${weekStripHTML(model, selectedIso, now)}
    ${weekBannersHTML(model, selectedIso)}
    <h2 class="dayhead">${esc(dayTitle(selectedIso))}${isToday ? ` <span class="tag tone-azur">Aujourd’hui</span>` : ""}</h2>
    <div class="pl-daylist" data-swipe="day">${dayListHTML(model, selectedIso, now)}</div>`;
}
