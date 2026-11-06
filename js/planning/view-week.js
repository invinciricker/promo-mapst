/* =====================================================================================
   view-week.js: the « Semaine » view (Monday to Friday, plus the weekend days that have
   a personal event). On a laptop the days sit side by side.
   ===================================================================================== */

import { esc, icon } from "../core/dom.js";
import { parseISO, toISO, addDays, startOfWeek, DAYS, capitalize, duration } from "../core/dates.js";
import { dayBanners, dayItemsHTML } from "./parts.js";

export function weekViewHTML(model, iso, now) {
  const monday = startOfWeek(parseISO(iso));
  const todayIso = toISO(now);
  let html = "";

  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const dayIso = toISO(date);
    const { html: rows, count } = dayItemsHTML(model, dayIso, now, { compact: true });
    if (i >= 5 && !count) continue;                       // empty weekend: not shown

    const day = model.day(dayIso);
    const isToday = dayIso === todayIso;
    const total = model.classMinutes(dayIso);
    let content = dayBanners(model, dayIso, todayIso);
    if (count) content += `<div class="wday__list">${rows}</div>`;
    else if (!day.holiday && !day.vacation) {
      content += `<div class="wday__list"><div class="wday__off">${icon("sun")}Rien de prévu</div></div>`;
    }

    html += `<section class="wday${isToday ? " wday--today" : ""}">
        <header class="wday__head">
          <button type="button" class="wday__name" data-goto-day="${dayIso}" aria-label="${esc(`Voir la journée du ${DAYS[date.getDay()]} ${date.getDate()}`)}">
            ${esc(capitalize(DAYS[date.getDay()]))} ${date.getDate()}${isToday ? ` <span class="today-dot" aria-label="aujourd’hui"></span>` : ""}
          </button>
          <span class="wday__total">${total ? esc(duration(total)) : ""}</span>
        </header>
        ${content}
      </section>`;
  }
  return `<div class="week">${html}</div>`;
}
