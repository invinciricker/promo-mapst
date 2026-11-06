/* =====================================================================================
   infos.js: the Infos screen (button ⓘ at the top right).
   Source and date of the planning, the « à vérifier » notes, the colours, what the app
   stores, how to install it, and the footer text.
   ===================================================================================== */

import { esc, icon, isInstalled, setHTML } from "../core/dom.js";
import { parseISO, dayNumber, MONTHS } from "../core/dates.js";
import { FOOTER } from "../core/texts.js";
import { countEvents } from "../planning/personal.js";
import { hasProgress, resetProgress } from "../reviser/progress.js";
import { showToast } from "../core/toast.js";
import { installStepsHTML, openInstallSheet } from "./install.js";

const longFR = (iso) => {
  if (!iso) return "";
  const d = parseISO(iso);
  return `${dayNumber(d)} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * @param container  the <section> of the screen
 * @param model      the planning (or null if it could not be loaded)
 * @param version    the version of the app (shown at the bottom)
 */
export function renderInfos(container, model, version) {
  const source = model ? model.source : {};
  const sources = (source.sources || []).map((s) => `<li>${icon("check")}<span>${esc(s)}</span></li>`).join("");

  const planning = model ? `
    <section class="section">
      <div class="section__head"><h2 class="section__title">Le planning</h2></div>
      <div class="list">
        <div class="list__row"><span class="list__icon cat-cours">${icon("planning")}</span>
          <div class="list__body"><p class="list__title">Planning MAPST de CAPA Sports</p>
          <p class="list__text">Version du ${esc(longFR(source.planningDate))}</p></div></div>
        <div class="list__row"><span class="list__icon cat-centre">${icon("check")}</span>
          <div class="list__body"><p class="list__title">Mis à jour dans l’appli</p>
          <p class="list__text">Le ${esc(longFR(source.exported))}${source.corrections ? `, avec les corrections du ${esc(longFR(source.corrections))}` : ""}</p></div></div>
      </div>
      ${sources ? `<div class="card prose"><p><b>Sources</b></p><ul>${sources}</ul>
        <p>Les formateurs sont indiqués par leurs initiales. Les dates de dossiers viennent du calendrier de la formation : à confirmer avec CAPA.</p></div>` : ""}
    </section>
    ${model.checks.length ? `<section class="section">
      <div class="section__head"><h2 class="section__title">À vérifier</h2><span class="section__aside">${model.checks.length} points</span></div>
      <div class="list">${model.checks.map((c) => `
        <div class="list__row"><span class="list__icon" style="--soft:var(--warn-soft);--ink:var(--warn-ink)">${icon("alert")}</span>
          <div class="list__body"><p class="list__title">${esc(c.title)}</p><p class="list__text">${esc(c.text)}</p></div></div>`).join("")}
      </div></section>` : ""}
    <section class="section">
      <div class="section__head"><h2 class="section__title">Les couleurs</h2><span class="section__aside">noms niçois</span></div>
      <div class="list legend-list">${["cours", "prepa", "centre", "epreuve", "libre", "perso"].map((id) => {
        const c = model.category(id);
        return `<div class="list__row cat-${id}"><span class="pebble" aria-hidden="true"></span>
          <div class="list__body"><p class="list__title">${esc(c.name)} · ${esc(c.label)}</p><p class="list__text">${esc(c.desc)}</p></div></div>`;
      }).join("")}</div>
    </section>` : "";

  const events = countEvents();
  setHTML(container, `
    <div class="wrap screen__body">
      <section class="card infos-intro">
        <img class="infos-intro__logo" src="icons/icon-192.png" alt="" width="60" height="60">
        <div><p class="infos-intro__name">Promo MAPST</p>
          <p class="infos-intro__text">L’appli de la promo BPJEPS MAPST de CAPA Sports, à Nice (sept. 2026 → juin 2027).</p></div>
      </section>

      <div class="note-box">${icon("alert")}<p><b>${esc(FOOTER.split(". ")[0])}.</b> ${esc(FOOTER.split(". ").slice(1).join(". "))}</p></div>

      ${planning}

      <section class="section">
        <div class="section__head"><h2 class="section__title">Ce que l’appli enregistre</h2></div>
        <div class="card prose">
          <p>Uniquement sur ce téléphone, dans l’appli :</p>
          <ul>
            <li>${icon("check")}<span>tes événements perso (« + ») : ${events ? `${events} pour l’instant` : "aucun pour l’instant"} ;</span></li>
            <li>${icon("check")}<span>ta progression dans Réviser : XP, série, leçons faites, questions à revoir, et ton choix pour les sons ;</span></li>
            <li>${icon("check")}<span>la vue du planning que tu as choisie, et si tu as fermé l’aide à l’installation ;</span></li>
            <li>${icon("check")}<span>une copie de l’appli, du planning et des questions, pour qu’elle marche sans internet.</span></li>
          </ul>
          <p>Rien n’est envoyé ailleurs : pas de compte, pas de cookies, pas de statistiques, pas de publicité. Si tu supprimes l’appli, tes événements perso et ta progression sont effacés aussi.</p>
        </div>
        ${hasProgress() ? `<button type="button" class="btn btn--danger btn--block" data-reset-reviser>${icon("trash")}Effacer ma progression dans Réviser</button>` : ""}
      </section>

      <section class="section">
        <div class="section__head"><h2 class="section__title">Installer l’appli</h2>
          <span class="section__aside">${isInstalled() ? "déjà installée ✓" : ""}</span></div>
        <div class="card prose">${installStepsHTML()}</div>
        ${isInstalled() ? "" : `<button type="button" class="btn btn--secondary btn--block" data-install>${icon("phone")}Installer sur ce téléphone</button>`}
      </section>

      <section class="section">
        <div class="section__head"><h2 class="section__title">À propos</h2></div>
        <div class="list">
          <div class="list__row"><div class="list__body"><p class="list__title">Version</p></div><span class="list__end">${esc(version)}</span></div>
          <div class="list__row"><div class="list__body"><p class="list__title">Mode sombre</p>
            <p class="list__text">L’appli suit le réglage clair ou sombre de ton téléphone.</p></div></div>
          <div class="list__row"><div class="list__body"><p class="list__title">Police</p>
            <p class="list__text">Plus Jakarta Sans (licence libre SIL OFL)</p></div></div>
        </div>
      </section>

      <p class="footer">${esc(FOOTER)}</p>
    </div>`);

  const installButton = container.querySelector("[data-install]");
  if (installButton) installButton.addEventListener("click", openInstallSheet);

  // Two taps to erase: the first one asks « Sûr ? », the second one erases.
  const resetButton = container.querySelector("[data-reset-reviser]");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      if (!resetButton.classList.contains("is-armed")) {
        resetButton.classList.add("is-armed");
        resetButton.lastChild.textContent = "Touche encore pour tout effacer";
        setTimeout(() => {
          if (!resetButton.isConnected) return;
          resetButton.classList.remove("is-armed");
          resetButton.lastChild.textContent = "Effacer ma progression dans Réviser";
        }, 4000);
        return;
      }
      resetProgress();
      resetButton.remove();
      showToast("Progression de Réviser effacée");
    });
  }
}
