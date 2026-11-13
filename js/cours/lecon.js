/* =====================================================================================
   lecon.js: the screen of a lesson of Cours (Phase 5): a deck of cards, full screen,
   over the page of its chapter. Address: #cours/<chapitre>?lecon=<id>.

   How it goes:
     - At the top, on the gradient of Cours: × (leave), then one thin segment per card,
       filled up to the card on screen.
     - One card at a time (each « ## » title of the file starts a card, markdown.js).
       Tap the right two thirds of the screen, swipe left or press → : next card.
       Tap the left third, swipe right or press ← : previous card. The cards slide like
       the pages of the app. A long card scrolls inside.
     - A small question inside a card: tap a choice, the right one turns turquoise, a
       wrong one bougainvillier (the styles of Réviser), and the explanation appears.
       No XP, no lives. Going forward is blocked on that card until it is answered.
     - Last card, added by the app: « Leçon terminée », « Teste-toi » (when the chapter has
       a Réviser theme) and « Retour au chapitre ». Reaching it marks the lesson as read.
       In « Mode relecture », a lesson not checked yet ("brouillon") also gets the
       « Juste / À corriger » buttons there (js/reviser/verdict.js).
   The card where it was left is saved (lecons.js): reopening the lesson resumes there.
   The look is in css/10-lecons.css.
   ===================================================================================== */

import { esc, icon, setHTML } from "../core/dom.js";
import { openModal, closeModal, forgetModal, registerModal, push, switchTab, current, refreshPages } from "../core/nav.js";
import { hasOpenSheet } from "../core/sheet.js";
import { paintStatusBar } from "../core/statusbar.js";
import { data } from "../core/data.js";
import { isRelectureOn } from "../reviser/relecture.js";
import { verdictHTML, handleVerdictTap } from "../reviser/verdict.js";
import { playRight, playWrong } from "../reviser/sound.js";
import { CALLOUTS, inlineHTML } from "./markdown.js";
import { loadLesson, lessonProgress, saveAt, markRead, relectureItem } from "./lecons.js";

const SWIPE = 50;                 // pixels: a shorter move is not a swipe
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let open = null;                  // the lesson open now (there is only ever one)

/** A copy of a list in a random order (the choices of a question, like in Réviser). */
function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Opens a lesson from a button of Cours. From the path (the glass card), the page of its
 * chapter comes first, so that × goes back to the chapter.
 */
export async function startLecon(lesson) {
  if (!lesson || open) return;
  const chapterPath = `cours/${lesson.chapitre}`;
  if (current().path !== chapterPath) await push(chapterPath, { animate: false });
  openLecon(lesson);
}

// The lesson has its own address in Cours (?lecon=<id>): the app can open on it.
registerModal("lecon", (value) => {
  const lesson = data.cours ? data.cours.lesson(value) : null;
  if (!lesson || open) return false;
  openLecon(lesson);
  return true;
}, { tab: "cours" });

// -------------------------------------------------------------------------------------
// The screen
// -------------------------------------------------------------------------------------
function openLecon(lesson) {
  const chapter = lesson.chapter;
  const relecture = isRelectureOn() && lesson.draft;
  const root = document.createElement("div");
  root.className = `player player--lecon tone-${chapter.tone}`;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", `Leçon : ${lesson.title}`);
  setHTML(root, `
    <div class="player__head">
      <div class="player__top">
        <button type="button" class="icon-btn player__close" data-close aria-label="Quitter">${icon("x")}</button>
        <div class="lecon__segs" role="progressbar" aria-label="Avancement dans la leçon" aria-valuemin="1"></div>
      </div>
    </div>
    <div class="lecon__stage" aria-live="polite"></div>`);
  document.getElementById("layers").appendChild(root);

  const stage = root.querySelector(".lecon__stage");
  const segs = root.querySelector(".lecon__segs");
  let cards = [];             // the cards of the file (markdown.js)
  let index = 0;              // the card on screen; cards.length = the last card (« Leçon terminée »)
  let furthest = 0;           // cards before this one were passed: their question no longer blocks
  let cardEl = null;          // the element of the card on screen
  let running = [];           // the slide animations playing now
  let item = null;            // the lesson as the Relecture sees it (once the text is loaded)
  const answers = new Map();  // "card:question" -> { order, chosen } (questions answered)
  let closing = false;

  const total = () => cards.length + 1;          // with the last card added by the app
  const isEnd = (i) => i === cards.length;

  // ---- Loading -----------------------------------------------------------------------
  setHTML(stage, `<div class="lcard"><div class="lcard__inner lc-wait"><p class="faint">Chargement de la leçon…</p></div></div>`);
  loadLesson(lesson).then((loaded) => {
    if (closing) return;
    cards = loaded.cards;
    item = relectureItem(lesson);
    if (!cards.length) throw new Error("empty lesson");
    const saved = lessonProgress(lesson.id);
    index = Math.min(saved.at, cards.length - 1);
    furthest = index;
    drawSegments();
    show(index, 0);
  }).catch(() => {
    if (closing) return;
    setHTML(stage, `<div class="lcard"><div class="lcard__inner lc-wait">
        <div class="card empty">${icon("alert")}<b>Cette leçon n’a pas pu se charger.</b>
        <p>Vérifie ta connexion internet, puis réessaie.</p>
        <button type="button" class="btn btn--primary" data-close>Fermer</button></div></div></div>`);
  });

  // ---- The segments at the top ---------------------------------------------------------
  function drawSegments() {
    segs.setAttribute("aria-valuemax", String(total()));
    segs.innerHTML = Array.from({ length: total() }, () => "<i></i>").join("");
  }

  function paintSegments() {
    [...segs.children].forEach((seg, i) => seg.classList.toggle("is-on", i <= index));
    segs.setAttribute("aria-valuenow", String(index + 1));
    segs.setAttribute("aria-valuetext", `Carte ${index + 1} sur ${total()}`);
  }

  // ---- One card as HTML ------------------------------------------------------------------
  function blockHTML(block, cardIndex, qIndex) {
    switch (block.type) {
      case "p":
        return `<p class="lc-p">${inlineHTML(block.text)}</p>`;
      case "ul":
        return `<ul class="lc-list">${block.items.map((t) => `<li>${inlineHTML(t)}</li>`).join("")}</ul>`;
      case "ol":
        return `<ol class="lc-list lc-list--num" start="${block.start}" style="counter-reset: lc ${block.start - 1}">${block.items.map((t) => `<li>${inlineHTML(t)}</li>`).join("")}</ol>`;
      case "table":
        return `<div class="lc-table"><table>
            <thead><tr>${block.head.map((c) => `<th>${inlineHTML(c)}</th>`).join("")}</tr></thead>
            <tbody>${block.rows.map((row) => `<tr>${row.map((c) => `<td>${inlineHTML(c)}</td>`).join("")}</tr>`).join("")}</tbody>
          </table></div>`;
      case "callout": {
        const box = CALLOUTS[block.name];
        return `<div class="lc-box tone-${box.tone}"><p class="lc-box__label">${icon(box.icon, "icon--xs")}${esc(box.label)}</p>
            <p class="lc-box__text">${inlineHTML(block.text)}</p></div>`;
      }
      case "img":
        return `<figure class="lc-img"><img src="content/lecons/${esc(block.src)}" alt="${esc(block.alt)}" loading="lazy" decoding="async"></figure>`;
      case "question":
        return questionHTML(block, cardIndex, qIndex);
      default:
        return "";
    }
  }

  function questionHTML(q, cardIndex, qIndex) {
    const key = `${cardIndex}:${qIndex}`;
    if (!answers.has(key)) answers.set(key, { order: shuffle(q.choices.map((_, i) => i)), chosen: null });
    const state = answers.get(key);
    return `<div class="lc-q" data-q="${qIndex}">
        <p class="lc-q__label">${icon("bolt", "icon--xs icon--fill")}Question</p>
        <p class="lc-q__text">${inlineHTML(q.text)}</p>
        <div class="choices" role="group" aria-label="Réponses">${state.order.map((i) => `
          <button type="button" class="choice" data-choice="${i}" data-right="${q.choices[i].right}" aria-pressed="false">
            <span class="choice__text">${inlineHTML(q.choices[i].text)}</span>
            <span class="choice__mark" aria-hidden="true"></span>
          </button>`).join("")}
        </div>
        <div class="lc-q__after" hidden></div>
      </div>`;
  }

  function endHTML() {
    const theme = chapter.theme;
    return `<div class="lcard__inner lc-end">
        <div class="lc-end__check" aria-hidden="true">${icon("check")}</div>
        <h2 class="lc-end__title">Leçon terminée</h2>
        <p class="lc-end__name">${esc(lesson.title)}</p>
        ${relecture && item ? `<div class="lc-end__verdict" data-verdict-slot>${verdictHTML(item, "Relecture : cette leçon est-elle juste ?")}</div>` : ""}
        <div class="lc-end__actions">
          ${theme ? `<button type="button" class="btn btn--primary btn--block" data-test>${icon("bolt", "icon--fill")}Teste-toi</button>` : ""}
          <button type="button" class="btn ${theme ? "btn--soft" : "btn--primary"} btn--block" data-back-chapter>Retour au chapitre</button>
        </div>
      </div>`;
  }

  function cardHTML(i) {
    if (isEnd(i)) return endHTML();
    const card = cards[i];
    let q = 0;
    const blocks = card.blocks.map((block) => blockHTML(block, i, block.type === "question" ? q++ : -1)).join("");
    const hint = i === 0 && index === 0 && furthest === 0
      ? `<p class="lc-hint">${icon("right", "icon--xs")}Touche à droite ou glisse pour avancer</p>` : "";
    return `<div class="lcard__inner">
        ${card.title ? `<h2 class="lcard__title">${inlineHTML(card.title)}</h2>` : ""}
        ${blocks}${hint}
      </div>`;
  }

  /** Shows the answers already given on a card drawn again (going back to it). */
  function restoreAnswers(el, i) {
    el.querySelectorAll(".lc-q").forEach((box) => {
      const state = answers.get(`${i}:${box.dataset.q}`);
      if (state && state.chosen !== null) paintAnswer(box, i, Number(box.dataset.q), false);
    });
  }

  // ---- Moving from card to card --------------------------------------------------------
  /** Shows card `to`. dir: 1 forward (it slides in from the right), -1 back, 0 none. */
  function show(to, dir) {
    running.forEach((a) => a.cancel());
    running = [];
    stage.querySelectorAll(".lcard").forEach((el) => { if (el !== cardEl) el.remove(); });
    const old = cardEl && cardEl.isConnected ? cardEl : stage.querySelector(".lcard");
    index = to;
    furthest = Math.max(furthest, to);
    const el = document.createElement("article");
    el.className = "lcard";
    el.setAttribute("aria-label", `Carte ${to + 1} sur ${total()}`);
    setHTML(el, cardHTML(to));
    restoreAnswers(el, to);
    cardEl = el;
    paintSegments();

    if (!old || !dir || reduceMotion()) {
      if (old) old.remove();
      stage.appendChild(el);
    } else {
      // Like the pages of the app: forward, the new card slides over the old one, which
      // moves a little to the left; back, the card on screen slides away to the right.
      const options = { duration: 420, easing: getComputedStyle(document.documentElement).getPropertyValue("--ease-page").trim() || "ease-out" };
      if (dir > 0) {
        stage.appendChild(el);
        el.classList.add("is-moving");
        running = [el.animate([{ transform: "translateX(100%)" }, { transform: "none" }], options),
          old.animate([{ transform: "none" }, { transform: "translateX(-30%)", opacity: 0.6 }], options)];
      } else {
        stage.insertBefore(el, old);
        old.classList.add("is-moving");
        running = [old.animate([{ transform: "none" }, { transform: "translateX(100%)" }], options),
          el.animate([{ transform: "translateX(-30%)", opacity: 0.6 }, { transform: "none", opacity: 1 }], options)];
      }
      const mine = running;
      Promise.all(mine.map((a) => a.finished.catch(() => null))).then(() => {
        if (running !== mine) return;
        old.remove();
        el.classList.remove("is-moving");
        running = [];
      });
    }

    if (isEnd(to)) {
      markRead(lesson.id);
      refreshPages();               // the chapter and the path show the check behind
    } else {
      saveAt(lesson.id, to);
    }
  }

  /** Is there a question on the card on screen that blocks going forward? */
  function blocked() {
    if (isEnd(index) || index < furthest) return null;
    return [...cardEl.querySelectorAll(".lc-q")].find((box) => answers.get(`${index}:${box.dataset.q}`).chosen === null) || null;
  }

  function next() {
    if (!cards.length || isEnd(index)) return;
    const waiting = blocked();
    if (waiting) {
      // Answer first: the question shakes, and comes into view.
      waiting.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" });
      waiting.classList.remove("is-shaking");
      void waiting.offsetWidth;
      waiting.classList.add("is-shaking");
      return;
    }
    show(index + 1, 1);
  }

  function previous() {
    if (cards.length && index > 0) show(index - 1, -1);
  }

  // ---- Answering a question --------------------------------------------------------------
  function paintAnswer(box, cardIndex, qIndex, fresh) {
    const q = cards[cardIndex].blocks.filter((b) => b.type === "question")[qIndex];
    const state = answers.get(`${cardIndex}:${qIndex}`);
    const right = q.choices[state.chosen].right;
    box.querySelectorAll("[data-choice]").forEach((b) => {
      const i = Number(b.dataset.choice);
      const isRight = q.choices[i].right;
      const chosen = i === state.chosen;
      b.disabled = true;
      b.setAttribute("aria-pressed", String(chosen));
      b.classList.add("is-checked", isRight && chosen ? "is-right" : isRight ? "is-missed" : chosen ? "is-wrong" : "is-dim");
      const mark = b.querySelector(".choice__mark");
      if (isRight) mark.innerHTML = icon("check");
      else if (chosen) mark.innerHTML = icon("x");
    });
    const after = box.querySelector(".lc-q__after");
    setHTML(after, `<p class="lc-q__result ${right ? "is-right" : "is-wrong"}"><span class="lc-q__icon">${icon(right ? "check" : "x")}</span>${right ? "Bonne réponse !" : "Pas tout à fait"}</p>
      ${q.explanation ? `<p class="lc-q__expl">${inlineHTML(q.explanation)}</p>` : ""}`);
    after.hidden = false;
    if (fresh) {
      after.classList.add("anim-fade-up");
      if (!right) {
        box.classList.remove("is-shaking");
        void box.offsetWidth;
        box.classList.add("is-shaking");
      }
      requestAnimationFrame(() => after.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" }));
    }
    return right;
  }

  function choose(button) {
    const box = button.closest(".lc-q");
    const qIndex = Number(box.dataset.q);
    const state = answers.get(`${index}:${qIndex}`);
    if (!state || state.chosen !== null) return;
    state.chosen = Number(button.dataset.choice);
    if (paintAnswer(box, index, qIndex, true)) playRight();
    else playWrong();
  }

  // ---- Taps, swipes and keys -----------------------------------------------------------
  root.addEventListener("click", (event) => {
    const t = event.target;
    if (t.closest("[data-close]")) { close(); return; }
    if (t.closest("[data-back-chapter]")) { close(); return; }
    if (t.closest("[data-test]")) { close().then(() => switchTab("reviser", { push: `reviser/${chapter.theme}` })); return; }
    if (item && t.closest("[data-verdict-slot]")) {
      handleVerdictTap(event, item, () => {
        const slot = root.querySelector("[data-verdict-slot]");
        if (slot) setHTML(slot, verdictHTML(item, "Relecture : cette leçon est-elle juste ?"));
      });
      return;
    }
    const choice = t.closest("[data-choice]");
    if (choice) { if (!choice.disabled) choose(choice); return; }
    if (!t.closest(".lecon__stage") || t.closest("button, a, input")) return;
    const selection = window.getSelection && String(window.getSelection());
    if (selection) return;                       // the person was selecting text
    const box = stage.getBoundingClientRect();
    if (event.clientX - box.left < box.width / 3) previous();
    else next();
  });

  let touch = null;
  stage.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) { touch = null; return; }
    const t = event.touches[0];
    // A table wider than the card scrolls sideways: a swipe on it is for the table.
    const table = event.target.closest && event.target.closest(".lc-table");
    touch = table && table.scrollWidth > table.clientWidth + 1 ? null : { x: t.clientX, y: t.clientY };
  }, { passive: true });
  stage.addEventListener("touchend", (event) => {
    if (!touch) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - touch.x;
    const dy = t.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) < SWIPE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) next();
    else previous();
  });

  function onKey(event) {
    if (hasOpenSheet() || event.defaultPrevented) return;
    const typing = event.target && event.target.matches && event.target.matches("input, textarea");
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (typing) return;
    else if (event.key === "ArrowRight") { event.preventDefault(); next(); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
  }
  document.addEventListener("keydown", onKey);

  // ---- Opening and closing (the lesson is a "modal" of nav.js: « back » closes it) ------
  const modal = openModal({ key: "lecon", value: lesson.id, close: () => finishClose() });
  const waiting = [];

  /** Closes the lesson through the history (like « back »). */
  function close() {
    return new Promise((resolve) => {
      if (closing) return resolve();
      waiting.push(resolve);
      closeModal(modal);
    });
  }

  function finishClose() {
    if (closing) return;
    closing = true;
    forgetModal(modal);
    document.removeEventListener("keydown", onKey);
    document.documentElement.classList.remove("has-player", "has-lecon");
    paintStatusBar();
    const app = document.getElementById("app");
    if (app) app.inert = false;
    root.classList.remove("is-open");
    setTimeout(() => root.remove(), 420);
    if (open && open.root === root) open = null;
    refreshPages();                 // the chapter shows where the lesson stands
    waiting.splice(0).forEach((resolve) => resolve());
  }

  document.documentElement.classList.add("has-player", "has-lecon");
  paintStatusBar();                 // Android's status bar takes the colour of Cours
  open = { root, close };
  requestAnimationFrame(() => {
    root.classList.add("is-open");
    const app = document.getElementById("app");
    setTimeout(() => { if (app && open && open.root === root) app.inert = true; }, 420);
  });
}
