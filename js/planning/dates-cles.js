/* =====================================================================================
   dates-cles.js: the « Dates clés » page, opened from the Planning (#planning/dates-cles).
   Every key date by month: épreuves and dossiers with their J-x, holidays, the big steps
   of the year; « À confirmer » where the date comes from the older course calendar.
   A switch shows « Tout » or only « Épreuves et dossiers ». Tapping a date opens the
   planning on that day.
   ===================================================================================== */

import { esc, icon, setHTML } from "../core/dom.js";
import { toISO, parseISO, MONTHS, capitalize } from "../core/dates.js";
import { navbarHTML, back } from "../core/nav.js";
import { data } from "../core/data.js";
import { keyDateRowHTML } from "./parts.js";
import { showPlanningDay } from "./planning.js";

const isExam = (k) => k.kind === "epreuve" || k.kind === "dossier";

export function mountKeyDates(el) {
  if (!data.model) return null;
  let filter = "tout";

  function groupsHTML(list, todayIso) {
    let html = "";
    let month = "";
    let rows = "";
    const flush = () => { if (rows) html += `<div class="list">${rows}</div>`; rows = ""; };
    for (const k of list) {
      const key = k.date.slice(0, 7);
      if (key !== month) {
        flush();
        month = key;
        const d = parseISO(k.date);
        const year = d.getFullYear() !== new Date().getFullYear() && d.getMonth() === 0 ? ` ${d.getFullYear()}` : "";
        html += `<h2 class="month-title">${esc(capitalize(MONTHS[d.getMonth()]) + year)}</h2>`;
      }
      rows += keyDateRowHTML(k, todayIso);
    }
    flush();
    return html;
  }

  function draw() {
    const todayIso = toISO(new Date());
    const all = data.model.keyDates.filter((k) => filter === "tout" || isExam(k));
    const upcoming = all.filter((k) => (k.end || k.date) >= todayIso);
    const past = all.filter((k) => (k.end || k.date) < todayIso);
    setHTML(el, `
      ${navbarHTML("Planning", "Dates clés")}
        <div class="page__body">
        <h1 class="page-title kd-title">Dates clés</h1>
        <div class="seg" role="radiogroup" aria-label="Quelles dates">
          <span class="seg__thumb" aria-hidden="true" style="width:calc((100% - 6px) / 2);transform:translateX(${filter === "tout" ? 0 : 100}%)"></span>
          <button type="button" class="seg__btn" role="radio" aria-checked="${filter === "tout"}" data-filter="tout">Tout</button>
          <button type="button" class="seg__btn" role="radio" aria-checked="${filter === "examens"}" data-filter="examens">Épreuves et dossiers</button>
        </div>
        ${upcoming.length ? groupsHTML(upcoming, todayIso) : `<div class="card empty kd-empty">${icon("check")}<p>Plus aucune date à venir.</p></div>`}
        ${past.length ? `<details class="kd-past"><summary>${icon("right", "icon--xs")}Dates passées (${past.length})</summary>
          ${groupsHTML(past, todayIso)}</details>` : ""}
        <p class="footer-note">Les dates « À confirmer » viennent du calendrier de la formation (déc. 2025). En cas de doute, vérifie avec CAPA.</p>
      </div>`);
  }

  el.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-filter]");
    const day = event.target.closest("[data-goto-day]");
    if (choice && choice.dataset.filter !== filter) {
      filter = choice.dataset.filter;
      const scroll = el.scrollTop;
      draw();
      el.scrollTop = scroll;
    } else if (day) {
      showPlanningDay(day.dataset.gotoDay);
      back();
    }
  });

  draw();
  return { title: "Dates clés", refresh: draw };
}
