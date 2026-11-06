/* =====================================================================================
   view-year.js: the « Année » view (September to June, each day a small pebble coloured
   by its main activity). Tapping a day opens it; tapping a month opens the month.
   ===================================================================================== */

import { esc } from "../core/dom.js";
import { toISO, addDays, addMonths, MONTHS, capitalize, longDate } from "../core/dates.js";
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
      const dayIso = toISO(date);
      const cat = model.mainCategory(dayIso, personalOn(dayIso).length);
      const weekend = date.getDay() === 0 || date.getDay() === 6;
      if (cat && cat !== "libre" && cat !== "perso") trainingDays += 1;
      const cls = ["yday",
        cat ? `cat-${cat}` : weekend ? "yday--weekend" : "",
        dayIso === todayIso ? "yday--today" : "",
        dayIso < todayIso ? "yday--past" : ""].filter(Boolean).join(" ");
      const label = capitalize(longDate(date)) + (cat ? ", " + model.category(cat).label : "");
      grid += `<button type="button" class="${cls}" data-goto-day="${dayIso}" aria-label="${esc(label)}"></button>`;
    }

    const monthIso = toISO(month);
    const name = capitalize(MONTHS[month.getMonth()]) + (month.getMonth() === 0 || month.getMonth() === 8 ? ` ${month.getFullYear()}` : "");
    html += `<section class="card ymonth${monthIso === thisMonth ? " ymonth--current" : ""}">
        <button type="button" class="ymonth__head" data-goto-month="${monthIso}" aria-label="Ouvrir ${esc(name)}">
          <span class="ymonth__name">${esc(name)}</span>
          <span class="ymonth__count">${trainingDays ? `${trainingDays} j` : ""}</span>
        </button>
        <div class="ymonth__grid">${grid}</div>
      </section>`;
  }
  return `<div class="year">${html}</div>`;
}
