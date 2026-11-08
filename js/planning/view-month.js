/* =====================================================================================
   view-month.js: the « Mois » view (a calendar; each day takes the soft colour of its
   main activity). Tapping a day shows its half-days under the calendar.
   ===================================================================================== */

import { esc } from "../core/dom.js";
import { parseISO, toISO, addDays, startOfMonth, longDate, capitalize } from "../core/dates.js";
import { personalOn } from "./personal.js";
import { dayListHTML, dayTitle } from "./parts.js";

export function monthViewHTML(model, selectedIso, now) {
  const first = startOfMonth(parseISO(selectedIso));
  const todayIso = toISO(now);
  let grid = "";

  // Empty cells before the 1st (weeks start on Monday)
  const lead = (first.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) grid += `<span class="mday mday--blank" aria-hidden="true"></span>`;

  for (let date = first; date.getMonth() === first.getMonth(); date = addDays(date, 1)) {
    const iso = toISO(date);
    const personal = personalOn(iso).length;
    const cat = model.mainCategory(iso, personal);
    const off = !cat || cat === "libre";
    const deadline = model.keyDatesOn(iso).some((k) => k.kind === "epreuve" || k.kind === "dossier");
    const cls = ["mday", cat ? `cat-${cat}` : "", off ? "is-off" : "",
      iso === todayIso ? "is-today" : "", iso === selectedIso ? "is-on" : ""].filter(Boolean).join(" ");
    const dots = (deadline ? `<i class="cat-epreuve"></i>` : "") + (personal && cat !== "perso" ? `<i class="cat-perso"></i>` : "");
    const label = [capitalize(longDate(date)), cat ? model.category(cat).label : "",
      deadline ? "épreuve ou dossier" : "", personal ? "événement perso" : ""].filter(Boolean).join(", ");
    grid += `<button type="button" class="${cls}" data-select-day="${iso}" aria-pressed="${iso === selectedIso}" aria-label="${esc(label)}">
        <b>${date.getDate()}</b><span class="dots">${dots}</span>
      </button>`;
  }

  return `<div class="card month" data-swipe="month">
      <div class="month__dow" aria-hidden="true"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
      <div class="month__grid">${grid}</div>
    </div>
    <h2 class="dayhead">${esc(dayTitle(selectedIso))}${selectedIso === todayIso ? ` <span class="tag tone-azur">Aujourd’hui</span>` : ""}</h2>
    <div class="pl-daylist">${dayListHTML(model, selectedIso, now)}</div>`;
}
