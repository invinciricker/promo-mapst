/* =====================================================================================
   soon.js: the Étudier screen until Phase 3 is built. It shows « Bientôt », what is
   coming, and the list of themes (content/themes.json). When you come from a class of
   the planning (« Étudier ce thème »), its theme is highlighted.
   (Réviser had the same screen until Phase 2: it is now js/reviser/.)
   ===================================================================================== */

import { esc, icon, setHTML } from "../core/dom.js";
import { footerHTML } from "../core/texts.js";

const SCREENS = {
  etudier: {
    tone: "etudier",
    title: "Apprendre en profondeur",
    text: "Une bibliothèque de fiches claires pour comprendre, approfondir et découvrir, à ton rythme.",
    art: `<svg class="hero__art" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="70" cy="50" r="42" fill="#00E6BF"/>
        <path d="M44 34h16a8 8 0 0 1 8 8v32a6 6 0 0 0-6-6H44zM96 34H80a8 8 0 0 0-8 8v32a6 6 0 0 1 6-6h18z" fill="#103550"/>
      </svg>`,
    features: [
      ["tone-turquoise", "etudier", "Fiches courtes", "Des sections claires et un encadré « À retenir »."],
      ["tone-orange", "sparkles", "Le savais-tu ?", "Une anecdote pour mieux retenir."],
      ["tone-blue", "layers", "Schémas", "Des dessins faits pour l’appli."],
      ["tone-lavande", "reviser", "Teste-toi", "Les questions liées à la fiche."],
    ],
    themesTitle: "Les thèmes de la bibliothèque",
  },
};

/**
 * @param container  the <section> of the screen
 * @param mode       "etudier"
 * @param themes     content of content/themes.json
 * @param focusId    id of a theme to highlight (or null)
 */
export function renderSoon(container, mode, themes, focusId = null) {
  const s = SCREENS[mode];
  const focus = themes.find((t) => t.id === focusId) || null;

  const featureTiles = s.features.map(([tone, iconName, title, text]) => `
      <div class="card feature ${tone}">
        <span class="feature__icon">${icon(iconName)}</span>
        <p class="feature__title">${esc(title)}</p>
        <p class="feature__text">${esc(text)}</p>
      </div>`).join("");

  const themeRows = themes.map((t, i) => `
      <div class="list__row${focus && focus.id === t.id ? " is-focus" : ""}" ${focus && focus.id === t.id ? 'aria-current="true"' : ""}>
        <span class="theme-num">${i + 1}</span>
        <div class="list__body"><p class="list__title">${esc(t.title)}</p>
          ${focus && focus.id === t.id ? `<p class="list__text">Le thème du cours que tu regardais</p>` : ""}</div>
        <span class="list__end">${icon("lock", "icon--s")}Bientôt</span>
      </div>`).join("");

  setHTML(container, `
    <div class="wrap screen__body">
      <section class="hero hero--${s.tone}">
        ${s.art}
        <span class="hero__badge">${icon("sparkles")}Bientôt</span>
        <h2 class="hero__title">${esc(s.title)}</h2>
        <p class="hero__text">${esc(s.text)}</p>
      </section>
      ${focus ? `<div class="note-box" style="background:rgba(0,230,191,.14);color:var(--ok-ink)">${icon("sparkles")}
        <p><b>« ${esc(focus.title)} »</b> sera ici dès que les fiches seront prêtes.</p></div>` : ""}
      <section class="section">
        <div class="section__head"><h2 class="section__title">Ce qui arrive</h2></div>
        <div class="features">${featureTiles}</div>
      </section>
      ${themes.length ? `<section class="section">
        <div class="section__head"><h2 class="section__title">${esc(s.themesTitle)}</h2><span class="section__aside">${themes.length} thèmes</span></div>
        <div class="list">${themeRows}</div>
      </section>` : ""}
      ${footerHTML()}
    </div>`);
}
