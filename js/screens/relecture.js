/* =====================================================================================
   relecture.js (screen): the « Rapport de relecture », reached from Profil while the
   « Mode relecture » is on (#accueil/profil/relecture), or from the « Mode relecture »
   card of Réviser (#reviser/relecture).

   It shows how many unchecked questions ("brouillon") have a verdict, the « À corriger »
   list with the notes (tap one to change it), the progress lesson by lesson, and the
   text that « Copier le rapport » puts in the clipboard, to paste into Claude chat.
   « Effacer le rapport » (two taps) forgets every verdict.
   The verdicts themselves are saved by js/reviser/relecture.js.
   ===================================================================================== */

import { esc, icon, setHTML, copyText } from "../core/dom.js";
import { navbarHTML, switchTab } from "../core/nav.js";
import { showToast } from "../core/toast.js";
import { data } from "../core/data.js";
import { isRelectureOn, relectureSummary, reportText, clearVerdicts, verdictFor } from "../reviser/relecture.js";
import { openNoteSheet, shortText } from "../reviser/verdict.js";

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

/** The unchecked questions, lesson by lesson (in the order of the themes). */
function lessonsToCheck(content) {
  const groups = [];
  for (const theme of content.themes) {
    const mine = content.drafts.filter((q) => q.theme === theme.id);
    const numbers = [...new Set(mine.map((q) => q.lesson))].sort((a, b) => a - b);
    for (const number of numbers) {
      const questions = mine.filter((q) => q.lesson === number);
      groups.push({
        theme,
        number,
        label: content.lessonLabel(theme.id, number),
        total: questions.length,
        checked: questions.filter((q) => verdictFor(q)).length,
      });
    }
  }
  return groups;
}

/**
 * @param el         the page element
 * @param backLabel  « Profil » or « Réviser »: the page it was opened from
 */
export function mountRelecture(el, { backLabel = "Profil" } = {}) {
  let text = "";

  function draw() {
    const content = data.reviser;
    const s = relectureSummary(content);
    const share = s.total ? Math.round((100 * s.checked) / s.total) : 0;
    text = reportText(content);
    const groups = lessonsToCheck(content);

    const toFix = s.corriger.length
      ? `<div class="list">${s.corriger.map(({ q, note }) => `
          <button type="button" class="row row--top rl-item" data-edit="${esc(q.id)}">
            <span class="row__main">
              <span class="tag tone-lavande">${esc(q.id)}</span>
              <span class="row__title rl-item__text">${esc(shortText(q.text, 110))}</span>
              <span class="row__sub rl-item__note">${note ? `Ta note : « ${esc(note)} »` : "Sans note"}</span>
            </span>
            ${icon("edit", "chev")}
          </button>`).join("")}
        </div>`
      : `<div class="card empty rl-empty">${icon("check")}<p>Rien à corriger pour l’instant.</p></div>`;

    const perLesson = groups.length
      ? `<div class="list">${groups.map((g) => `
          <button type="button" class="row" data-theme-link="${esc(g.theme.id)}">
            <span class="row__main">
              <span class="row__title">${esc(g.label)}</span>
              <span class="row__sub">${esc(g.theme.title)}${g.label.startsWith("Leçon ") ? "" : ` · Leçon ${g.number}`}</span>
            </span>
            <span class="tag ${g.checked === g.total ? "tone-turquoise" : "tone-lavande"} num">${g.checked}/${g.total}</span>
            ${icon("right", "chev")}
          </button>`).join("")}
        </div>`
      : "";

    setHTML(el, `
      <div class="page__body">
        ${navbarHTML(backLabel, "Rapport de relecture")}
        <h1 class="page-title page-title--pushed">Rapport de relecture</h1>
        <section class="card rl-head tone-lavande">
          ${s.total ? `
            <p class="rl-head__count"><b class="num">${s.checked}</b> sur ${plural(s.total, "question à vérifier", "questions à vérifier")}</p>
            <span class="bar" role="img" aria-label="${share} %"><i style="width:${share}%"></i></span>
            <div class="rl-chips">
              <span class="chip chip--s tone-turquoise">${icon("check", "icon--xs")}${plural(s.juste.length, "juste", "justes")}</span>
              <span class="chip chip--s tone-citron">${icon("edit", "icon--xs")}${s.corriger.length} à corriger</span>
              <span class="chip chip--s tone-galet">${icon("clock", "icon--xs")}${plural(s.todo.length, "pas encore relue", "pas encore relues")}</span>
            </div>`
          : `<p class="sheet-text">Aucune question à vérifier pour l’instant : elles sont toutes vérifiées.</p>`}
          <button type="button" class="btn btn--primary btn--block" data-copy${s.checked ? "" : " disabled"}>${icon("copy")}Copier le rapport</button>
          <p class="rl-help">${s.checked ? "Colle-le ensuite dans ta conversation avec Claude chat." : "Joue des leçons dans Réviser et donne ton avis sur chaque question : le rapport se remplit tout seul."}</p>
        </section>

        ${isRelectureOn() ? "" : `<div class="note rl-off">${icon("info")}<span><b>Le mode relecture est désactivé.</b> Active-le dans Profil pour voir les badges « À vérifier » dans Réviser.</span></div>`}

        <h2 class="section-title">À corriger${s.corriger.length ? ` <span class="small faint">touche une question pour changer ta note</span>` : ""}</h2>
        ${toFix}

        ${perLesson ? `<h2 class="section-title">Leçon par leçon <span class="small faint">questions relues</span></h2>${perLesson}` : ""}

        ${s.checked ? `<h2 class="section-title">Le texte copié</h2>
          <pre class="rl-preview" data-preview tabindex="0"></pre>
          <button type="button" class="btn btn--danger btn--block rl-clear" data-clear><span>Effacer le rapport</span></button>
          <p class="rl-help">Efface tous tes avis « Juste » et « À corriger ». À faire une fois le rapport envoyé à Claude chat.</p>` : ""}
      </div>`);

    // The preview is exactly the copied text (plain spaces, no typography), so copying it
    // by hand gives the same result as « Copier le rapport ».
    const preview = el.querySelector("[data-preview]");
    if (preview) preview.textContent = text;
  }

  el.addEventListener("click", async (event) => {
    const target = event.target;
    if (target.closest("[data-copy]")) {
      const ok = await copyText(text);
      if (ok) {
        showToast("Rapport copié : colle-le dans Claude chat");
      } else {
        // The phone refused: select the text so the person can copy it by hand.
        const preview = el.querySelector("[data-preview]");
        if (preview) {
          preview.scrollIntoView({ block: "center", behavior: "smooth" });
          const range = document.createRange();
          range.selectNodeContents(preview);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
        showToast("Copie impossible : le texte est sélectionné, copie-le à la main");
      }
    } else if (target.closest("[data-edit]")) {
      const q = data.reviser.drafts.find((x) => x.id === target.closest("[data-edit]").dataset.edit);
      if (q) openNoteSheet(q, draw);
    } else if (target.closest("[data-theme-link]")) {
      switchTab("reviser", { push: `reviser/${target.closest("[data-theme-link]").dataset.themeLink}` });
    } else if (target.closest("[data-clear]")) {
      // Two taps to erase: the first one asks, the second one erases.
      const button = target.closest("[data-clear]");
      const label = button.querySelector("span");
      if (!button.classList.contains("is-armed")) {
        button.classList.add("is-armed");
        label.textContent = "Touche encore pour tout effacer";
        setTimeout(() => {
          if (!button.isConnected) return;
          button.classList.remove("is-armed");
          label.textContent = "Effacer le rapport";
        }, 4000);
        return;
      }
      clearVerdicts();
      showToast("Rapport effacé");
      draw();
    }
  });

  draw();
  return { title: "Rapport de relecture", refresh: draw, onShow: draw };
}
