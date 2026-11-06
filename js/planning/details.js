/* =====================================================================================
   details.js: the sheet that opens when you tap a half-day of the planning.
   It shows the date, the hours, the place, the trainers, the official wording, the
   « à vérifier » note, and buttons « Réviser ce thème » / « Étudier ce thème » when the
   topic matches a theme (see content/planning-themes.json).
   ===================================================================================== */

import { esc, icon } from "../core/dom.js";
import { parseISO, longDate, capitalize, hour, duration, minutes, daysBetween, todayISO, countdown } from "../core/dates.js";
import { openSheet } from "../core/sheet.js";

const HALF = { am: "Matin", pm: "Après-midi" };

function fact(iconName, label, value, small = "") {
  return `<div class="fact">${icon(iconName)}
      <div><p class="fact__label">${esc(label)}</p><p class="fact__value">${esc(value)}${small ? `<small>${esc(small)}</small>` : ""}</p></div>
    </div>`;
}

/**
 * @param model    the planning (model.js)
 * @param slot     the half-day
 * @param onTheme  function(mode, themeId) called by « Réviser / Étudier ce thème »
 */
export function openSlotDetails(model, slot, { onTheme }) {
  const date = parseISO(slot.iso);
  const category = model.category(slot.cat);
  const themes = model.themesFor(slot);
  const stage = model.stageOn(slot.iso);
  const left = daysBetween(parseISO(todayISO()), date);

  const facts = [
    fact("clock", "Quand", capitalize(longDate(date)),
      `${HALF[slot.half] || ""} · ${hour(slot.start)} → ${hour(slot.end)} (${duration(minutes(slot.end) - minutes(slot.start))})`),
  ];
  if (slot.place) facts.push(fact("pin", "Lieu", slot.place));
  if (slot.who) facts.push(fact("user", "Avec", slot.who, /\.\s|\.$/.test(slot.who) ? "Initiales des formateurs" : ""));
  if (slot.planning) facts.push(fact("planning", "Écrit au planning", `« ${slot.planning} »`));
  if (stage) facts.push(fact("layers", "Période", stage.title));

  const chips = [`<span class="badge badge--cat"><span class="pebble" aria-hidden="true"></span>${esc(category.label)}</span>`];
  if (slot.cat === "epreuve" && left >= 0) chips.push(`<span class="badge badge--solid">${esc(countdown(left))}</span>`);

  let body = `<div class="details__kind cat-${esc(slot.cat)}">${chips.join("")}</div>
    <div class="facts">${facts.join("")}</div>`;

  if (slot.note) {
    body += `<div class="note-box">${icon("alert")}<p><b>À vérifier.</b> ${esc(slot.note)}</p></div>`;
  }

  if (themes.length) {
    body += `<div class="section">
        <h3 class="section__title" style="font-size:18px">Revoir ce cours</h3>
        <div class="theme-links">${themes.map((t) => `
          <div class="theme-link">
            <p class="theme-link__name">${esc(t.title)}</p>
            <div class="theme-link__btns">
              <button type="button" class="btn btn--primary" data-theme-mode="reviser" data-theme-id="${esc(t.id)}">${icon("reviser")}Réviser ce thème</button>
              <button type="button" class="btn btn--secondary" data-theme-mode="etudier" data-theme-id="${esc(t.id)}">${icon("etudier")}Étudier ce thème</button>
            </div>
          </div>`).join("")}
        </div>
      </div>`;
  }

  body += `<p class="footer">D’après le planning CAPA du ${esc(model.source.planningDateLabel || "")}. En cas de doute, vérifie dans tes cours.</p>`;

  const sheet = openSheet({ title: slot.title, body, className: `cat-${slot.cat}` });
  sheet.body.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-mode]");
    if (!button) return;
    sheet.close().then(() => onTheme(button.dataset.themeMode, button.dataset.themeId));
  });
}
