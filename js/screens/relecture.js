/* =====================================================================================
   relecture.js (screen): the « Rapport de relecture », reached from Infos while the
   « Mode relecture » is on (address #infos/relecture).

   It shows how many unchecked questions ("brouillon") have a verdict, the « À corriger »
   list with the notes (tap one to change it), the progress lesson by lesson, and the
   text that « Copier le rapport » puts in the clipboard, to paste into Claude chat.
   « Effacer le rapport » (two taps) forgets every verdict.
   The verdicts themselves are saved by js/reviser/relecture.js.
   ===================================================================================== */

import { esc, icon, setHTML, copyText } from "../core/dom.js";
import { go } from "../core/router.js";
import { showToast } from "../core/toast.js";
import { footerHTML } from "../core/texts.js";
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
 * @param container  the <section> of the Infos screen
 * @param content    the content of Réviser (js/reviser/content.js)
 * @param onBack     what « ‹ Infos » does (app.js knows where the person came from)
 */
export function renderRelecture(container, content, { onBack = () => go("infos") } = {}) {
  const s = relectureSummary(content);
  const share = s.total ? Math.round((100 * s.checked) / s.total) : 0;
  const text = reportText(content);
  const groups = lessonsToCheck(content);

  const toFix = s.corriger.length
    ? `<div class="list">${s.corriger.map(({ q, note }) => `
        <button type="button" class="list__row rl-item" data-edit="${esc(q.id)}">
          <div class="list__body">
            <p class="rl-item__id"><span class="badge badge--id">${esc(q.id)}</span></p>
            <p class="list__title">${esc(shortText(q.text, 110))}</p>
            <p class="list__text">${note ? `Ta note : « ${esc(note)} »` : "Sans note"}</p>
          </div>
          <span class="list__end">${icon("edit", "icon--s")}</span>
        </button>`).join("")}
      </div>`
    : `<div class="card empty rl-empty">${icon("check")}<p>Rien à corriger pour l’instant.</p></div>`;

  const perLesson = groups.length
    ? `<div class="list">${groups.map((g) => `
        <button type="button" class="list__row" data-theme-link="${esc(g.theme.id)}">
          <div class="list__body">
            <p class="list__title">${esc(g.label)}</p>
            <p class="list__text">${esc(g.theme.title)}${g.label.startsWith("Leçon ") ? "" : ` · Leçon ${g.number}`}</p>
          </div>
          <span class="rl-count${g.checked === g.total ? " is-done" : ""}">${g.checked === g.total ? icon("check", "icon--s") : ""}${g.checked}/${g.total}</span>
          ${icon("right", "icon--s")}
        </button>`).join("")}
      </div>`
    : "";

  setHTML(container, `
    <div class="wrap screen__body">
      <section class="card card--float rl-head">
        <button type="button" class="rv-back" data-back>${icon("left", "icon--s")}Infos</button>
        <p class="rv-eyebrow">Mode relecture ${isRelectureOn() ? "activé" : "désactivé"}</p>
        <h2 class="rl-head__title">Rapport de relecture</h2>
        ${s.total ? `
          <p class="rl-head__count"><b>${s.checked}</b> sur ${plural(s.total, "question à vérifier", "questions à vérifier")}</p>
          <span class="rv-progress rl-head__bar" role="img" aria-label="${share} %"><i style="width:${share}%"></i></span>
          <div class="rl-chips">
            <span class="rl-chip rl-chip--ok">${icon("check", "icon--s")}${plural(s.juste.length, "juste", "justes")}</span>
            <span class="rl-chip rl-chip--fix">${icon("edit", "icon--s")}${s.corriger.length} à corriger</span>
            <span class="rl-chip">${icon("clock", "icon--s")}${plural(s.todo.length, "pas encore relue", "pas encore relues")}</span>
          </div>`
        : `<p class="sheet-text">Aucune question à vérifier pour l’instant : elles sont toutes vérifiées.</p>`}
        <button type="button" class="btn btn--primary btn--block btn--big" data-copy${s.checked ? "" : " disabled"}>${icon("copy")}Copier le rapport</button>
        <p class="rl-help">${s.checked ? "Colle-le ensuite dans ta conversation avec Claude chat." : "Joue des leçons dans Réviser et donne ton avis sur chaque question : le rapport se remplit tout seul."}</p>
      </section>

      ${isRelectureOn() ? "" : `<div class="note-box">${icon("alert")}<p><b>Le mode relecture est désactivé.</b> Active-le dans Infos pour voir les questions à vérifier dans Réviser.</p></div>`}

      <section class="section">
        <div class="section__head"><h2 class="section__title">À corriger</h2>
          ${s.corriger.length ? `<span class="section__aside">touche une question pour changer ta note</span>` : ""}</div>
        ${toFix}
      </section>

      ${perLesson ? `<section class="section">
        <div class="section__head"><h2 class="section__title">Leçon par leçon</h2><span class="section__aside">questions relues</span></div>
        ${perLesson}
      </section>` : ""}

      ${s.checked ? `<section class="section">
        <div class="section__head"><h2 class="section__title">Le texte copié</h2></div>
        <pre class="rl-preview" data-preview tabindex="0">${esc(text)}</pre>
      </section>` : ""}

      ${s.checked ? `<section class="section">
        <button type="button" class="btn btn--danger btn--block" data-clear>${icon("trash")}<span>Effacer le rapport</span></button>
        <p class="rl-help">Efface tous tes avis « Juste » et « À corriger ». À faire une fois le rapport envoyé à Claude chat.</p>
      </section>` : ""}
      ${footerHTML()}
    </div>`);

  // The preview is exactly the copied text (plain spaces, no typography), so copying it
  // by hand gives the same result as « Copier le rapport ».
  const preview = container.querySelector("[data-preview]");
  if (preview) preview.textContent = text;

  const rerender = () => renderRelecture(container, content, { onBack });

  // One click handler for the whole screen (set again at each drawing, never doubled).
  container.onclick = async (event) => {
    const target = event.target;
    if (target.closest("[data-back]")) {
      onBack();
    } else if (target.closest("[data-copy]")) {
      const ok = await copyText(text);
      if (ok) {
        showToast("Rapport copié : colle-le dans Claude chat");
      } else {
        // The phone refused: select the text so the person can copy it by hand.
        const preview = container.querySelector("[data-preview]");
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
      const q = content.drafts.find((x) => x.id === target.closest("[data-edit]").dataset.edit);
      if (q) openNoteSheet(q, rerender);
    } else if (target.closest("[data-theme-link]")) {
      go("reviser", target.closest("[data-theme-link]").dataset.themeLink, { push: true });
      window.scrollTo(0, 0);
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
      rerender();
    }
  };
}
