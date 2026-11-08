/* =====================================================================================
   view-year.js: the « Année » view (September to June, each day a small pebble coloured
   by its main activity), then the stages of the year. Tapping a day opens its week;
   tapping a month opens the month.
   ===================================================================================== */

import { esc, icon } from "../core/dom.js";
import { toISO, addDays, addMonths, MONTHS, capitalize, longDate, parseISO, dayMonth } from "../core/dates.js";
import { personalOn } from "./personal.js";

export function yearViewHTML(model, now) {
  const todayIso = toISO(now);
  const thisMonth = toISO(new Date(now.getFullYear(), now.getMonth(), 1));
  let html = "";

  for (let month = model.firstDay; month <= model.lastDay; month = addMonths(month, 1)) {
    let grid = "";
    let trainingDays = 0;
    const lead = (month.getDay() + 6) % 7;
    for (let i = 0; i < lead; i++) grid += `<span class="yday yday--blank" aria-hidden="true"></span>`;

    for (let date = month; date.getMonth() === month.getMonth(); date = addDays(date, 1)) {
      const iso = toISO(date);
      const cat = model.mainCategory(iso, personalOn(iso).length);
      if (cat && cat !== "libre" && cat !== "perso") trainingDays += 1;
      const cls = ["yday", cat ? `cat-${cat}` : "is-empty", iso === todayIso ? "is-today" : "", iso < todayIso ? "is-past" : ""]
        .filter(Boolean).join(" ");
      const label = capitalize(longDate(date)) + (cat ? ", " + model.category(cat).label : "");
      grid += `<button type="button" class="${cls}" data-goto-week="${iso}" aria-label="${esc(label)}"></button>`;
    }

    const monthIso = toISO(month);
    const name = capitalize(MONTHS[month.getMonth()]) + (month.getMonth() === 0 || month.getMonth() === 8 ? ` ${month.getFullYear()}` : "");
    html += `<section class="card ymonth${monthIso === thisMonth ? " is-current" : ""}">
        <button type="button" class="ymonth__head" data-goto-month="${monthIso}" aria-label="Ouvrir ${esc(name)}">
          <span class="ymonth__name">${esc(name)}</span>
          <span class="ymonth__count">${trainingDays ? `${trainingDays} j` : ""}</span>
        </button>
        <div class="ymonth__grid">${grid}</div>
      </section>`;
  }
  return `<div class="year">${html}</div>${stagesHTML(model, todayIso)}`;
}

/** « Les étapes de l'année »: the big periods (cours au CAL, MSP, certifications...). */
function stagesHTML(model, todayIso) {
  const rows = model.stages.map((s) => {
    const past = s.end < todayIso;
    const current = s.start <= todayIso && todayIso <= s.end;
    return `<button type="button" class="row row--top stage cat-${esc(s.cat)}${past ? " is-past" : ""}" data-goto-week="${esc(s.start)}">
        <span class="slot-bar" aria-hidden="true"></span>
        <span class="row__main">
          <span class="stage__dates">${esc(dayMonth(parseISO(s.start)))} → ${esc(dayMonth(parseISO(s.end)))}${current ? ` <span class="tag tone-turquoise">En cours</span>` : ""}</span>
          <span class="row__title">${esc(s.title)}</span>
          <span class="row__sub">${esc(s.text)}</span>
        </span>
        ${icon("right", "chev")}
      </button>`;
  }).join("");
  return `<h2 class="section-title">Les étapes de l’année</h2><div class="list stages">${rows}</div>`;
}
