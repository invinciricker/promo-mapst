/* =====================================================================================
   view-month.js: the « Mois » view (a calendar; each day is a pebble coloured by its
   main activity). Tapping a day shows it under the calendar.
   ===================================================================================== */

import { esc } from "../core/dom.js";
import { parseISO, toISO, addDays, startOfMonth, longDate, capitalize } from "../core/dates.js";
import { personalOn } from "./personal.js";

export function monthViewHTML(model, iso, selectedIso, now) {
  const first = startOfMonth(parseISO(iso));
  const todayIso = toISO(now);
  let grid = "";

  // Empty cells before the 1st (weeks start on Monday)
  const lead = (first.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) grid += `<span class="mday mday--blank" aria-hidden="true"></span>`;

  for (let date = first; date.getMonth() === first.getMonth(); date = addDays(date, 1)) {
    const dayIso = toISO(date);
    const personal = personalOn(dayIso).length;
    const off = model.isOff(dayIso);
    const cat = model.mainCategory(dayIso, personal);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const school = model.schoolHolidayOn(dayIso);
    const deadline = model.keyDatesOn(dayIso).some((k) => k.kind === "epreuve" || k.kind === "dossier");

    const cls = ["mday",
      cat && !off && cat !== "libre" ? `cat-${cat}` : "",
      off || cat === "libre" ? "mday--off" : "",
      !cat && weekend ? "mday--weekend" : "",
      dayIso === todayIso ? "mday--today" : "",
      dayIso === selectedIso ? "mday--selected" : "",
      school ? "mday--school" : ""].filter(Boolean).join(" ");

    const dots = (deadline ? "<i></i>" : "") + (personal && cat !== "perso" ? `<i class="is-perso"></i>` : "");
    const label = [capitalize(longDate(date)),
      cat ? model.category(cat).label : "",
      deadline ? "épreuve ou dossier" : "",
      personal ? "événement perso" : "",
      school ? "vacances scolaires" : ""].filter(Boolean).join(", ");

    grid += `<button type="button" class="${cls}" data-select-day="${dayIso}" aria-pressed="${dayIso === selectedIso}" aria-label="${esc(label)}">
        <span class="mday__num">${date.getDate()}</span>${dots ? `<span class="mday__dots">${dots}</span>` : ""}
      </button>`;
  }

  return `<div class="card month">
      <div class="month__dow" aria-hidden="true"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
      <div class="month__grid">${grid}</div>
    </div>`;
}
