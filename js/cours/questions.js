/* =====================================================================================
   questions.js: « Questions de la promo » (Phase 6). Classmates ask questions about the
   course; the admin of the promo answers; everybody sees the answers.

     #cours/questions          the list (newest first): « Toutes » / « Sans réponse »
                               (and « À répondre » first, for the admin, oldest first)
     ?question=<id>            one question, in a sheet: the whole text, who and when, its
                               chapter, « Moi aussi », the answer; the author can delete it;
                               the admin answers, changes the answer, deletes
     ?poser=<chapter id>       « Poser une question » (a sheet), with its chapter or none

   Ways in (js/cours/cours.js): the glass button « Poser une question » in the header of
   Cours, the row « Questions de la promo » at the top of the path, and « Une question
   sur ce chapitre ? » at the bottom of each chapter. Nothing on Accueil.
   The list is read when the page opens and with « Actualiser »; the last one is kept on
   the phone for offline (js/compte/compte.js).
   ===================================================================================== */

import { esc, icon, setHTML } from "../core/dom.js";
import { navbarHTML, registerModal, push, switchTab } from "../core/nav.js";
import { openSheet } from "../core/sheet.js";
import { showToast } from "../core/toast.js";
import { dayNumber, MONTHS } from "../core/dates.js";
import { data } from "../core/data.js";
import { comptesActifs, compte, estAdmin, chargerQuestions, questionsEnCache, poser, moiAussi, repondre,
  supprimerQuestion } from "../compte/compte.js";
import { avatarHTML, ilYa, openCompteSheet, MESSAGES } from "../screens/compte.js";
import { misAJour, refreshButton } from "../reviser/classement.js";

const MAX = 500;               // characters of a question (the database rules say the same)
const MAX_ANSWER = 2000;
const message = (error) => MESSAGES[error && error.code] || MESSAGES.inconnu;
const changed = () => window.dispatchEvent(new CustomEvent("questions-change"));

/** The chapter of a question ({ id, title, tone }) or null. */
const chapterOf = (id) => (id && data.cours && data.cours.chapter(id)) || null;

/** « le 12 novembre » */
const onDay = (ms) => { const d = new Date(ms); return `le ${dayNumber(d)} ${MONTHS[d.getMonth()]}`; };

/** The question of the saved list, or null. */
const findQuestion = (id) => { const saved = questionsEnCache(); return (saved && saved.list.find((q) => q.id === id)) || null; };

/** The two account buttons, for a person without an account. */
const accountButtons = () => `<div class="sheet__actions">
    <button type="button" class="btn btn--primary btn--block" data-compte="creer">Créer mon compte</button>
    <button type="button" class="btn btn--block" data-compte="connecter">J’ai déjà un compte</button></div>`;

// -------------------------------------------------------------------------------------
// The list
// -------------------------------------------------------------------------------------
export function mountQuestions(el) {
  let saved = questionsEnCache();          // { list, at } or null
  let filter = null;                       // "arepondre" (admin), "toutes", "sans"
  let admin = false;
  let loading = false;
  let failed = "";

  function filters() {
    return [...(admin ? [["arepondre", "À répondre"]] : []), ["toutes", "Toutes"], ["sans", "Sans réponse"]];
  }

  function shown() {
    const list = saved ? saved.list : [];
    if (filter === "sans") return list.filter((q) => !q.reponse);
    if (filter === "arepondre") return list.filter((q) => !q.reponse).slice().reverse();     // oldest first
    return list;
  }

  function cardHTML(q, i) {
    const chapter = chapterOf(q.chapitre);
    return `<button type="button" class="card qcard tap${i < 8 ? " rise" : ""}" style="--i:${i}" data-question="${esc(q.id)}">
        <span class="qcard__main">
          <span class="qcard__text">${esc(q.texte)}</span>
          <span class="qcard__meta"><span>${esc(q.pseudo)} · ${esc(ilYa(q.creeLe))}</span>
            ${chapter ? `<span class="qcard__chap tone-${chapter.tone}">${esc(chapter.title)}</span>` : ""}</span>
        </span>
        <span class="qcard__end">
          ${q.reponse ? `<span class="tag tone-turquoise">Répondu</span>` : `<span class="tag tone-galet">En attente</span>`}
          ${q.aussi.length ? `<span class="qcard__aussi">Moi aussi · ${q.aussi.length}</span>` : ""}
        </span>
      </button>`;
  }

  function draw() {
    const me = compte();
    const kinds = filters();
    if (!kinds.some(([id]) => id === filter)) filter = kinds[0][0];
    let content;
    if (!me) {
      content = `<div class="card empty questions__empty">${icon("chat")}
          <b>Les questions de la promo</b><p>Crée ton compte pour lire les questions de la promo et poser les tiennes.</p>
          ${accountButtons()}</div>`;
    } else {
      const list = shown();
      const index = kinds.findIndex(([id]) => id === filter);
      let cards;
      if (list.length) cards = `<div class="questions__list${saved && saved.fresh ? " rises" : ""}">${list.map(cardHTML).join("")}</div>`;
      else if (saved) cards = `<div class="card empty">${icon("chat")}<p>${filter === "toutes" ? "Aucune question pour l’instant. Pose la première !" : "Toutes les questions ont une réponse."}</p></div>`;
      else if (failed) cards = `<div class="card empty">${icon("alert")}<p>${esc(failed)}</p></div>`;
      else cards = `<div class="card empty"><p>Un instant…</p></div>`;
      if (saved) saved.fresh = false;
      content = `<button type="button" class="btn btn--primary btn--block questions__ask" data-poser>${icon("plus")}Poser une question</button>
        <div class="seg questions__seg" role="radiogroup" aria-label="Quelles questions">
          <span class="seg__thumb" aria-hidden="true" style="width:calc((100% - 6px) / ${kinds.length});transform:translateX(${index * 100}%)"></span>
          ${kinds.map(([id, label]) => `<button type="button" class="seg__btn" role="radio" aria-checked="${id === filter}" data-filter="${id}">${label}</button>`).join("")}
        </div>
        ${cards}
        ${saved && saved.at ? `<p class="small faint classement__when">${esc(misAJour(saved.at))}${failed ? ` · ${esc(failed)}` : ""}</p>` : ""}`;
    }
    setHTML(el, `
      ${navbarHTML("Cours", "Questions de la promo", me ? refreshButton() : "")}
      <div class="page__body questions">
        <h1 class="page-title">Questions de la promo</h1>
        ${content}
      </div>`);
    const button = el.querySelector("[data-refresh]");
    if (button) button.classList.toggle("is-spinning", loading);
  }

  async function reload() {
    if (!compte() || loading) return;
    loading = true;
    draw();
    try {
      saved = { ...(await chargerQuestions()), fresh: true };
      failed = "";
    } catch (error) {
      failed = message(error);
    } finally {
      loading = false;
      if (el.isConnected) draw();
    }
  }

  el.addEventListener("click", (event) => {
    const t = event.target;
    const question = t.closest("[data-question]");
    const kind = t.closest("[data-filter]");
    const account = t.closest("[data-compte]");
    if (t.closest("[data-refresh]")) reload();
    else if (t.closest("[data-poser]")) openAskSheet();
    else if (account) openCompteSheet({ mode: account.dataset.compte });
    else if (question) openQuestionSheet(question.dataset.question);
    else if (kind && kind.dataset.filter !== filter) { filter = kind.dataset.filter; draw(); }
  });

  // A question asked, answered or deleted (in a sheet): the list follows.
  const onChange = () => { saved = questionsEnCache(); draw(); };
  const onAsked = () => reload();
  const onCompte = () => {
    estAdmin().then((yes) => { if (yes !== admin) { admin = yes; filter = null; draw(); } });
    saved = questionsEnCache();
    draw();
    if (compte() && !saved) reload();
  };
  window.addEventListener("questions-change", onChange);
  window.addEventListener("question-posee", onAsked);
  window.addEventListener("compte-change", onCompte);

  estAdmin().then((yes) => { if (yes && el.isConnected) { admin = true; filter = null; draw(); } });
  draw();
  reload();
  return {
    title: "Questions de la promo",
    refresh: draw,
    destroy: () => {
      window.removeEventListener("questions-change", onChange);
      window.removeEventListener("question-posee", onAsked);
      window.removeEventListener("compte-change", onCompte);
    },
  };
}

// -------------------------------------------------------------------------------------
// One question
// -------------------------------------------------------------------------------------
export function openQuestionSheet(id) {
  if (!findQuestion(id)) return null;
  const sheet = openSheet({ title: "Question", className: "qsheet-sheet", address: ["question", id] });
  let admin = false;

  function draw() {
    const q = findQuestion(id);
    const me = compte();
    if (!q || !me) { sheet.close(); return; }
    const mine = q.auteur === me.cle;
    const on = q.aussi.includes(me.cle);
    const chapter = chapterOf(q.chapitre);
    setHTML(sheet.body, `
      <p class="qsheet__text selectable">${esc(q.texte)}</p>
      <div class="qsheet__who">${avatarHTML(q.pseudo)}<span><b>${esc(q.pseudo)}</b> · ${esc(ilYa(q.creeLe))}</span></div>
      ${chapter ? `<button type="button" class="qsheet__chap tap tone-${chapter.tone}" data-chapitre="${esc(chapter.id)}">${icon("book", "icon--xs")}<span>${esc(chapter.title)}</span>${icon("right", "icon--xs")}</button>` : ""}
      ${mine ? "" : `<button type="button" class="btn btn--block qsheet__aussi${on ? " is-on" : ""}" data-aussi aria-pressed="${on}">${icon(on ? "check" : "users")}Moi aussi${q.aussi.length ? ` · ${q.aussi.length}` : ""}</button>`}
      <h3 class="qsheet__title">Réponse</h3>
      ${q.reponse
        ? `<div class="qsheet__answer"><p class="selectable">${esc(q.reponse)}</p>${q.reponduLe ? `<span class="small faint">${esc(onDay(q.reponduLe))}</span>` : ""}</div>`
        : `<p class="muted qsheet__none">Pas encore de réponse.</p>`}
      ${admin ? `<form class="qsheet__admin" novalidate>
          <label class="field"><span class="field__label">Ta réponse</span>
            <textarea class="input" name="reponse" maxlength="${MAX_ANSWER}" rows="5">${esc(q.reponse)}</textarea></label>
          <p class="form-msg" data-err="general" role="alert"></p>
          <button type="submit" class="btn btn--primary btn--block">${q.reponse ? "Modifier la réponse" : "Publier la réponse"}</button>
        </form>` : ""}
      ${admin || mine ? `<button type="button" class="btn btn--danger btn--block qsheet__delete" data-delete><span>${admin ? "Supprimer la question" : "Supprimer ma question"}</span></button>` : ""}`);
  }

  sheet.body.addEventListener("click", async (event) => {
    const t = event.target;
    const chap = t.closest("[data-chapitre]");
    if (chap) {
      await sheet.close();
      switchTab("cours", { push: `cours/${chap.dataset.chapitre}` });
      return;
    }
    const aussi = t.closest("[data-aussi]");
    if (aussi && !aussi.disabled) {
      aussi.disabled = true;
      const q = findQuestion(id);
      try {
        await moiAussi(id, !q.aussi.includes(compte().cle));
        changed();
        draw();
      } catch (error) {
        showToast(message(error));
        aussi.disabled = false;
      }
      return;
    }
    const remove = t.closest("[data-delete]");
    if (remove) {
      // Two taps: the first one asks, the second one deletes.
      const label = remove.querySelector("span");
      if (!remove.classList.contains("is-armed")) {
        remove.classList.add("is-armed");
        label.textContent = "Touche encore pour supprimer";
        setTimeout(() => { if (remove.isConnected) draw(); }, 4000);
        return;
      }
      remove.disabled = true;
      try {
        await supprimerQuestion(id);
        await sheet.close();
        showToast("Question supprimée.");
        changed();
      } catch (error) {
        showToast(message(error));
        remove.disabled = false;
      }
    }
  });
  sheet.body.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const text = form.elements.namedItem("reponse").value.trim();
    const msg = form.querySelector('[data-err="general"]');
    const button = form.querySelector('[type="submit"]');
    if (!text) { msg.textContent = "Écris ta réponse d’abord."; return; }
    button.disabled = true;
    try {
      await repondre(id, text);
      showToast("Réponse publiée.");
      changed();
      draw();
    } catch (error) {
      msg.textContent = message(error);
      button.disabled = false;
    }
  });

  draw();
  estAdmin().then((yes) => { if (yes && sheet.el.isConnected) { admin = true; draw(); } });
  return sheet;
}

// -------------------------------------------------------------------------------------
// « Poser une question »
// -------------------------------------------------------------------------------------
export function openAskSheet({ chapitre = "" } = {}) {
  const me = compte();
  const sheet = openSheet({ title: "Poser une question", className: "ask-sheet", address: ["poser", chapitre] });
  if (!me) {
    setHTML(sheet.body, `<p class="sheet-text">Il faut un compte pour poser une question.</p>${accountButtons()}`);
    sheet.body.addEventListener("click", async (event) => {
      const account = event.target.closest("[data-compte]");
      if (!account) return;
      await sheet.close();
      openCompteSheet({ mode: account.dataset.compte });
    });
    return sheet;
  }
  const chapters = data.cours ? data.cours.chapters : [];
  setHTML(sheet.body, `<form class="ask-form" novalidate>
      <div class="field">
        <textarea class="input ask-form__text" name="texte" maxlength="${MAX}" rows="5" aria-label="Ta question"
          placeholder="Ta question, comme tu la poserais en cours"></textarea>
        <div class="ask-form__under"><span class="field__hint">Toute la promo verra ta question avec ton pseudo.</span>
          <span class="ask-form__count" aria-live="polite">0/${MAX}</span></div>
      </div>
      <label class="field"><span class="field__label">Chapitre</span>
        <select class="input" name="chapitre">
          <option value="">Aucun</option>
          ${chapters.map((c) => `<option value="${esc(c.id)}"${c.id === chapitre ? " selected" : ""}>${esc(c.title)}</option>`).join("")}
        </select></label>
      <p class="form-msg" data-err="general" role="alert"></p>
      <div class="sheet__actions"><button type="submit" class="btn btn--primary btn--block" disabled>Envoyer</button></div>
    </form>`);
  const form = sheet.body.querySelector("form");
  const text = form.elements.namedItem("texte");
  const count = form.querySelector(".ask-form__count");
  const button = form.querySelector('[type="submit"]');
  const msg = form.querySelector('[data-err="general"]');
  const update = () => {
    count.textContent = `${text.value.length}/${MAX}`;
    button.disabled = text.value.trim().length < 3;
  };
  text.addEventListener("input", update);
  if (window.matchMedia("(pointer: fine)").matches) requestAnimationFrame(() => text.focus({ preventScroll: true }));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = text.value.trim();
    if (value.length < 3 || button.disabled) return;
    msg.textContent = "";
    button.disabled = true;
    button.textContent = "Un instant…";
    try {
      await poser({ texte: value, chapitre: form.elements.namedItem("chapitre").value });
      await sheet.close();
      showToast("Question envoyée.");
      window.dispatchEvent(new CustomEvent("question-posee"));
    } catch (error) {
      msg.textContent = message(error);          // the text typed stays
      button.textContent = "Envoyer";
      update();
    }
  });
  return sheet;
}

// The sheets have their own address (the app can open on them, « back » closes them).
registerModal("question", (id) => (comptesActifs() && compte() ? Boolean(openQuestionSheet(id)) : false));
registerModal("poser", (chapitre) => {
  if (!comptesActifs()) return false;
  openAskSheet({ chapitre: chapterOf(chapitre) ? chapitre : "" });
  return true;
});

/** From Cours: opens the list. */
export const openQuestions = () => push("cours/questions");
