/* =====================================================================================
   profil.js: Profil (mockup 8), opened from the round initial on Accueil. It replaces
   the Infos screen of Phases 1 and 2 (old #infos addresses open it).

     #accueil/profil            the first name and « Changer mon prénom »; « Mode
                                relecture » (and « Rapport de relecture » while it is
                                on); « Installer l'appli » when not installed;
                                « À propos du planning »; « Ce que l'appli garde »; the
                                footer text
     #accueil/profil/planning   À propos du planning: source, dates, corrections, notes
     #accueil/profil/donnees    Ce que l'appli garde, and « Effacer ma progression »
   ===================================================================================== */

import { esc, icon, setHTML, isInstalled } from "../core/dom.js";
import { parseISO, dayNumber, MONTHS } from "../core/dates.js";
import { FOOTER, APP_VERSION } from "../core/texts.js";
import { data } from "../core/data.js";
import { push, navbarHTML, registerModal } from "../core/nav.js";
import { openSheet } from "../core/sheet.js";
import { showToast } from "../core/toast.js";
import { firstName, setFirstName, initial, NAME_MAX } from "../core/user.js";
import { skyAt } from "../core/sun.js";
import { countEvents } from "../planning/personal.js";
import { hasProgress, resetProgress } from "../reviser/progress.js";
import { isRelectureOn, setRelectureOn, relectureSummary } from "../reviser/relecture.js";
import { openInstallSheet } from "./install.js";

/** « 1er octobre 2026 » */
const longFR = (iso) => {
  if (!iso) return "";
  const d = parseISO(iso);
  return `${dayNumber(d)} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
/** « 1er octobre » */
const shortFR = (iso) => longFR(iso).replace(/ \d{4}$/, "");

// -------------------------------------------------------------------------------------
// Profil
// -------------------------------------------------------------------------------------
export function mountProfil(el) {
  function draw() {
    const name = firstName();
    const letter = initial(name);
    const sky = skyAt(new Date());
    const on = isRelectureOn();
    const s = on && data.reviser ? relectureSummary(data.reviser) : null;
    const source = data.model ? data.model.source : {};
    const about = data.model
      ? `Version du ${shortFR(source.planningDate)}${source.corrections ? `, corrigée le ${shortFR(source.corrections)}` : ""}`
      : "Le planning n’a pas pu se charger";
    setHTML(el, `
      <div class="page__body profil">
        ${navbarHTML("Accueil", "Profil")}
        <div class="me-big">
          <div class="me-big__avatar me-big__avatar--${sky}"><img src="img/baie-${sky}.svg" alt="">${letter ? `<b>${esc(letter)}</b>` : `<b>${icon("person")}</b>`}</div>
          <h1>${esc(name || "Ton profil")}</h1>
          <button type="button" class="me-big__link" data-name>${name ? "Changer mon prénom" : "Ajouter mon prénom"}</button>
        </div>

        <div class="list">
          <label class="row tone-lavande">
            <span class="tile-icon">${icon("eye", "icon--s")}</span>
            <span class="row__main"><span class="row__title">Mode relecture</span>
              <span class="row__sub">Pour vérifier les questions et signaler les erreurs.</span></span>
            <span class="switch"><input type="checkbox" role="switch" data-relecture aria-label="Mode relecture"${on ? " checked" : ""}><span class="switch__track"></span></span>
          </label>
          ${s ? `<button type="button" class="row tone-lavande" data-report>
            <span class="tile-icon">${icon("clipboard", "icon--s")}</span>
            <span class="row__main"><span class="row__title">Rapport de relecture</span>
              <span class="row__sub">${s.checked} sur ${s.total} relues${s.corriger.length ? ` · ${s.corriger.length} à corriger` : ""}</span></span>
            ${icon("right", "chev")}</button>` : ""}
        </div>

        <h2 class="group-title">L’appli</h2>
        <div class="list">
          ${isInstalled() ? "" : `<button type="button" class="row tone-turquoise" data-install>
            <span class="tile-icon">${icon("phone", "icon--s")}</span>
            <span class="row__main row__title">Installer l’appli</span>${icon("right", "chev")}</button>`}
          <button type="button" class="row tone-azur" data-about>
            <span class="tile-icon">${icon("cal", "icon--s")}</span>
            <span class="row__main"><span class="row__title">À propos du planning</span><span class="row__sub">${esc(about)}</span></span>
            ${icon("right", "chev")}</button>
          <button type="button" class="row tone-galet" data-stored>
            <span class="tile-icon">${icon("lock", "icon--s")}</span>
            <span class="row__main row__title">Ce que l’appli garde</span>${icon("right", "chev")}</button>
        </div>

        <p class="footer-note">${esc(FOOTER)}</p>
        <p class="footer-note profil__version">Version : ${esc(APP_VERSION)}</p>
      </div>`);

    // « Mode relecture »: app.js hears the change and rebuilds Réviser.
    const toggle = el.querySelector("[data-relecture]");
    toggle.addEventListener("change", () => {
      setRelectureOn(toggle.checked);
      showToast(toggle.checked ? "Mode relecture activé : les questions à vérifier ont un badge" : "Mode relecture désactivé");
      draw();
      const fresh = el.querySelector("[data-relecture]");
      if (fresh) fresh.focus({ preventScroll: true });
    });
  }

  el.addEventListener("click", (event) => {
    const t = event.target;
    if (t.closest("[data-name]")) openNameSheet();
    else if (t.closest("[data-report]")) push("accueil/profil/relecture");
    else if (t.closest("[data-install]")) openInstallSheet();
    else if (t.closest("[data-about]")) push("accueil/profil/planning");
    else if (t.closest("[data-stored]")) push("accueil/profil/donnees");
  });
  const onName = () => draw();
  window.addEventListener("prenom-change", onName);

  draw();
  return { title: "Profil", refresh: draw, onShow: draw, destroy: () => window.removeEventListener("prenom-change", onName) };
}

/** The sheet « Ton prénom » (Profil › Changer mon prénom). */
function openNameSheet() {
  const name = firstName();
  const sheet = openSheet({
    title: "Ton prénom",
    address: "prenom",
    body: `<form class="name-form" novalidate>
        <p class="sheet-text">Ton prénom ou un surnom, pour te dire bonjour. Il reste sur ce téléphone.</p>
        <input class="input input--big" name="prenom" type="text" maxlength="${NAME_MAX}" value="${esc(name)}"
          autocomplete="given-name" autocapitalize="words" enterkeyhint="done" placeholder="Ton prénom" aria-label="Ton prénom ou un surnom">
        <div class="sheet__actions">
          <button type="submit" class="btn btn--primary btn--block">Enregistrer</button>
          ${name ? `<button type="button" class="btn btn--danger btn--block" data-clear>Effacer mon prénom</button>` : ""}
        </div>
      </form>`,
  });
  const form = sheet.body.querySelector("form");
  const input = form.elements.namedItem("prenom");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const saved = setFirstName(input.value);
    sheet.close();
    showToast(saved ? `Bonjour ${saved} !` : "Prénom effacé");
  });
  const clear = form.querySelector("[data-clear]");
  if (clear) clear.addEventListener("click", () => { setFirstName(""); sheet.close(); showToast("Prénom effacé"); });
  if (window.matchMedia("(pointer: fine)").matches) requestAnimationFrame(() => input.focus({ preventScroll: true }));
}
registerModal("prenom", () => { openNameSheet(); return true; });

// -------------------------------------------------------------------------------------
// À propos du planning
// -------------------------------------------------------------------------------------
export function mountAboutPlanning(el) {
  function draw() {
    const model = data.model;
    if (!model) {
      setHTML(el, `<div class="page__body">${navbarHTML("Profil")}
          <div class="card empty">${icon("alert")}<b>Le planning n’a pas pu se charger.</b></div></div>`);
      return;
    }
    const source = model.source || {};
    const dated = model.checks.filter((c) => c.date);
    const undated = model.checks.filter((c) => !c.date);
    const noteRows = (list) => list.map((c) => `<div class="row row--top tone-citron">
        <span class="tile-icon">${icon("info", "icon--s")}</span>
        <span class="row__main"><span class="row__title">${esc(c.title)}</span><span class="row__sub">${esc(c.text)}</span></span></div>`).join("");
    setHTML(el, `
      <div class="page__body">
        ${navbarHTML("Profil", "À propos du planning")}
        <h1 class="page-title page-title--pushed">À propos du planning</h1>
        <div class="list">
          <div class="row tone-azur"><span class="tile-icon">${icon("cal", "icon--s")}</span>
            <span class="row__main"><span class="row__title">Planning MAPST de CAPA Sports</span>
            <span class="row__sub">Version du ${esc(longFR(source.planningDate))}</span></span></div>
          ${source.corrections ? `<div class="row tone-olivier"><span class="tile-icon">${icon("check", "icon--s")}</span>
            <span class="row__main"><span class="row__title">Corrigé dans l’appli</span>
            <span class="row__sub">Le ${esc(longFR(source.corrections))}</span></span></div>` : ""}
        </div>
        ${dated.length ? `<h2 class="group-title">Corrections</h2><div class="list">${noteRows(dated)}</div>` : ""}
        ${undated.length ? `<h2 class="group-title">À savoir</h2><div class="list">${noteRows(undated)}</div>` : ""}
        ${(source.sources || []).length ? `<h2 class="group-title">Sources</h2>
          <div class="list">${source.sources.map((s) => `<div class="row"><span class="row__main row__sub">${esc(s)}</span></div>`).join("")}</div>` : ""}
        <p class="footer-note">Les formateurs sont indiqués par leurs initiales. Les dates de dossiers viennent du calendrier de la formation : à confirmer avec CAPA.</p>
      </div>`);
  }
  draw();
  return { title: "À propos du planning", refresh: draw };
}

// -------------------------------------------------------------------------------------
// Ce que l'appli garde
// -------------------------------------------------------------------------------------
export function mountStoredData(el) {
  function draw() {
    const name = firstName();
    const events = countEvents();
    const items = [
      ["person", "Ton prénom", name ? `« ${name} »` : "Aucun pour l’instant"],
      ["cal", "Tes événements perso (« + »)", events ? `${events} pour l’instant` : "Aucun pour l’instant"],
      ["bolt", "Ta progression dans Réviser", "XP, série, leçons faites ou en cours, questions à revoir"],
      ["eye", "Le mode relecture", "Et tes avis « Juste » ou « À corriger », si tu l’utilises"],
      ["swatch", "Tes réglages", "La vue du planning et les sons"],
      ["download", "Une copie de l’appli", "Avec le planning et les questions, pour qu’elle marche sans internet"],
    ];
    setHTML(el, `
      <div class="page__body">
        ${navbarHTML("Profil", "Ce que l’appli garde")}
        <h1 class="page-title page-title--pushed">Ce que l’appli garde</h1>
        <p class="muted stored__lead">Uniquement sur ce téléphone, dans l’appli :</p>
        <div class="list">${items.map(([name2, title, text]) => `<div class="row row--top tone-galet">
            <span class="tile-icon">${icon(name2, "icon--s")}</span>
            <span class="row__main"><span class="row__title">${esc(title)}</span><span class="row__sub">${esc(text)}</span></span></div>`).join("")}
        </div>
        <div class="note stored__note">${icon("lock")}<span><b>Rien n’est envoyé ailleurs.</b> Pas de compte (pour l’instant), pas de cookies, pas de statistiques, pas de publicité. Si tu supprimes l’appli, tout ce qu’elle garde est effacé aussi.</span></div>
        ${hasProgress() ? `<button type="button" class="btn btn--danger btn--block stored__reset" data-reset><span>Effacer ma progression dans Réviser</span></button>` : ""}
      </div>`);
  }

  // Two taps to erase: the first one asks « Sûr ? », the second one erases.
  el.addEventListener("click", (event) => {
    const button = event.target.closest("[data-reset]");
    if (!button) return;
    const label = button.querySelector("span");
    if (!button.classList.contains("is-armed")) {
      button.classList.add("is-armed");
      label.textContent = "Touche encore pour tout effacer";
      setTimeout(() => {
        if (!button.isConnected) return;
        button.classList.remove("is-armed");
        label.textContent = "Effacer ma progression dans Réviser";
      }, 4000);
      return;
    }
    resetProgress();
    showToast("Progression de Réviser effacée");
    draw();
  });

  draw();
  return { title: "Ce que l’appli garde", refresh: draw };
}
