/* =====================================================================================
   details.js: the sheet that opens when you tap a half-day (Planning or Accueil).
   Its category, title, date, hours, place, trainers, the « à vérifier » note, and
   « Réviser ce thème » when its topic matches a theme (content/planning-themes.json).
   (« Étudier ce thème » comes back in Phase 5, with the Étudier tab.)
   ===================================================================================== */

import { esc, icon } from "../core/dom.js";
import { parseISO, longDate, capitalize, clock, daysBetween, todayISO, countdown } from "../core/dates.js";
import { openSheet } from "../core/sheet.js";
import { switchTab } from "../core/nav.js";
import { data } from "../core/data.js";

const fact = (iconName, text, small = "") => `<li>${icon(iconName, "icon--s")}<span>${esc(text)}${small ? `<small>${esc(small)}</small>` : ""}</span></li>`;

/**
 * @param model  the planning (model.js)
 * @param slot   the half-day
 */
export function openSlotDetails(model, slot) {
  const date = parseISO(slot.iso);
  const category = model.category(slot.cat);
  const themes = model.themesFor(slot);
  const left = daysBetween(parseISO(todayISO()), date);

  const facts = [fact("cal", capitalize(longDate(date))), fact("clock", `${clock(slot.start)} – ${clock(slot.end)}`)];
  if (slot.place) facts.push(fact("pin", slot.place));
  if (slot.who) facts.push(fact("person", slot.who, /\.\s|\.$/.test(slot.who) ? "Initiales des formateurs" : ""));

  const head = `<span class="chip chip--s cat-${esc(slot.cat)}">${esc(category.label)}</span>
    ${slot.cat === "epreuve" && left >= 0 ? `<span class="chip chip--s tone-bougainvillier num">${esc(countdown(left))}</span>` : ""}`;

  let body = `<h2 class="details__title">${esc(slot.title)}</h2>
    <ul class="facts">${facts.join("")}</ul>`;
  if (slot.planning) body += `<p class="details__official">Au planning officiel : « ${esc(slot.planning)} »</p>`;
  if (slot.note) {
    body += `<div class="banner tone-citron">${icon("info")}<span><b>À vérifier.</b> ${esc(slot.note)}</span></div>`;
  }
  for (const t of themes) {
    const theme = data.reviser && data.reviser.theme(t.id);
    const tone = theme ? theme.tone : "turquoise";
    const iconName = theme ? theme.icon : "bolt";
    body += `<div class="linked">
        <div class="linked__head tone-${tone}">
          <span class="tile-icon">${icon(iconName, "icon--s")}</span>
          <div class="row__main"><div class="small faint linked__label">Thème lié</div><div class="row__title">${esc(t.title)}</div></div>
        </div>
        <button type="button" class="btn btn--primary btn--block btn--medium" data-theme-id="${esc(t.id)}">Réviser ce thème</button>
      </div>`;
  }
  body += `<p class="footer-note details__source">D’après le planning CAPA du ${esc(model.source.planningDateLabel || "")}. En cas de doute, vérifie dans tes cours.</p>`;

  const sheet = openSheet({ head, body, className: `cat-${slot.cat} details`, address: ["seance", slot.id] });
  sheet.el.setAttribute("aria-label", slot.title);
  sheet.body.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-id]");
    if (!button) return;
    const id = button.dataset.themeId;
    sheet.close().then(() => switchTab("reviser", { push: `reviser/${id}` }));
  });
}
