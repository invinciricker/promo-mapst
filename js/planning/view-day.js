/* =====================================================================================
   view-day.js: the « Jour » view (one day, one card per half-day).
   ===================================================================================== */

import { esc, icon } from "../core/dom.js";
import { parseISO, toISO } from "../core/dates.js";
import { dayBanners, dayItemsHTML } from "./parts.js";

export function dayViewHTML(model, iso, now) {
  const day = model.day(iso);
  let html = dayBanners(model, iso, toISO(now));

  if (day.school && !day.vacation) {
    html += `<div class="day-tags"><span class="badge">${icon("sun")}${esc(day.school.title)} · zone B</span></div>`;
  }

  const { html: items, count } = dayItemsHTML(model, iso, now);
  if (count) {
    html += `<div class="day">${items}</div>`;
  } else if (!day.holiday && !day.vacation) {
    const weekend = [0, 6].includes(parseISO(iso).getDay());
    html += `<div class="card empty">${icon(weekend ? "sun" : "planning")}
        <p>${weekend ? "Week-end : pas de formation." : "Rien de prévu ce jour-là."}</p></div>`;
  }
  return html;
}
