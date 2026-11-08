/* =====================================================================================
   player.js: the screen of a lesson (or of « Mes erreurs »), over the whole app.

   How a lesson goes:
     1. The questions come in a random order (and the choices of a QCM too).
     2. The person answers, taps « Vérifier », and sees straight away if it is right:
        the feedback rises from the bottom, turquoise when right and bougainvillier when
        wrong, with a one-sentence explanation and the source (and « Approfondir » when a
        study page exists, from Phase 5).
     3. A wrong answer costs one of the 3 lives, and the question comes back at the end
        of the lesson. Losing all 3 lives restarts the lesson.
     4. When every question has been answered right, the lesson is finished: XP, série,
        a little celebration.
   A lesson left in the middle (×) is kept: « Continuer » starts again where it stopped
   (with the lives and XP it had). In « Mes erreurs » there are no lives, and a wrong
   answer simply stays to review; leaving it asks first.

   « Mode relecture » (Profil): a question not checked yet ("brouillon") shows an
   « À vérifier » badge and its id; after the answer, the letters A, B, C, D of the file
   appear on the choices (so a note can say « la réponse C ») and the buttons
   « Juste / À corriger » (verdict.js).

   Every answer is saved straight away (progress.js), so a mistake goes into
   « Mes erreurs » even if the lesson is left before the end.
   The lesson has its own address (#…?lecon=anatomie-mouvement-1, see js/core/nav.js).
   ===================================================================================== */

import { esc, icon, setHTML } from "../core/dom.js";
import { openSheet, hasOpenSheet } from "../core/sheet.js";
import { openModal, closeModal, forgetModal } from "../core/nav.js";
import { checkTyped } from "./answer.js";
import { recordAnswer, XP } from "./progress.js";
import { verdictHTML, handleVerdictTap } from "./verdict.js";
import { playRight, playWrong, playPair, playWin } from "./sound.js";
import { launchConfetti } from "./confetti.js";

const LIVES = 3;
const KEYS = ["1", "2", "3", "4", "5", "6"];
const LETTERS = "ABCDEFGH";
let current = null;       // the player open now (there is only ever one)

/** A copy of a list in a random order. */
function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

/**
 * Opens the player.
 *   title       « Anatomie et mouvement » (the theme, shown on the end screen)
 *   heading     « Leçon 1 · Os et articulations » (shown at the top of the lesson)
 *   questions   the questions (from content.js)
 *   address     [key, value] of the lesson: ["lecon", "anatomie-mouvement-1"]
 *   review      true for « Mes erreurs »: no lives, nothing comes back at the end
 *   relecture   true in « Mode relecture »: badges and verdicts on "brouillon" questions
 *   run         a lesson left in the middle (progress.js lessonRun): it continues
 *   onProgress  function(run) after each answer, to keep the lesson (progress.js saveRun)
 *   onLost      function() when all the lives are lost
 *   onFinish    function(result) called when everything is answered; it saves the
 *               session and returns { xp, xpTotal, streak, streakGrew } for the end screen
 *   onClose     function() called once the player is closed
 *   canStudy    function(studyId): true if a study page exists (« Approfondir »)
 *   onStudy     function(studyId): opens that study page
 */
export function openPlayer({ title, heading = "", questions, address = ["lecon", ""], review = false,
  relecture = false, run = null, onProgress = () => {}, onLost = () => {}, onFinish, onClose,
  canStudy = () => false, onStudy = () => {} }) {
  if (current) current.destroy();

  const root = document.createElement("div");
  root.className = "player";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", review ? "Révision de tes erreurs" : `Leçon : ${heading || title}`);
  setHTML(root, `
    <div class="player__top">
      <button type="button" class="icon-btn player__close" data-close aria-label="Quitter">${icon("x")}</button>
      <div class="player__bar" role="progressbar" aria-label="Avancement" aria-valuemin="0"><i></i></div>
      ${review
        ? `<span class="player__tag">${icon("repeat", "icon--xs")}Mes erreurs</span>`
        : `<span class="player__lives" aria-live="polite">${icon("heart", "icon--fill")}<b></b></span>`}
    </div>
    ${heading ? `<p class="player__heading">${esc(heading)}</p>` : ""}
    <div class="player__stage"><div class="player__inner"></div></div>
    <div class="player__bottom">
      <div class="player__feedback" aria-live="assertive"></div>
      <div class="player__actions">
        <button type="button" class="btn btn--primary btn--block" data-main disabled>Vérifier</button>
      </div>
    </div>`);
  document.getElementById("layers").appendChild(root);

  const inner = root.querySelector(".player__inner");
  const stage = root.querySelector(".player__stage");
  const bottom = root.querySelector(".player__bottom");
  const feedbackEl = root.querySelector(".player__feedback");
  const actions = root.querySelector(".player__actions");
  const bar = root.querySelector(".player__bar");
  const livesEl = root.querySelector(".player__lives b");

  let session;              // the state of the lesson, see start()
  let ui = {};              // the state of the question on screen
  let closing = false;
  const showRelecture = (q) => relecture && q.draft;

  // ---------------------------------------------------------------------------------
  // Start (and restart after losing all the lives)
  // ---------------------------------------------------------------------------------
  function start(from = null) {
    const done = new Set(from ? from.right : []);
    const missed = new Set(from ? from.missed : []);
    session = {
      queue: shuffle(questions.filter((q) => !done.has(q.id))).map((q) => ({ q, firstTry: !missed.has(q.id) })),
      total: questions.length,
      right: done.size,                          // questions answered right (at least once)
      rightIds: [...done],
      firstTryIds: from ? from.first.slice() : [],   // questions answered right the first time
      missedIds: [...missed],                    // answered wrong, not right yet
      mistakes: from ? from.mistakes : 0,
      answered: 0,                               // answers given since the player opened
      lives: from ? from.lives : LIVES,
      xp: from ? from.xp : 0,
      phase: "question",     // "question", "feedback", "lost" or "done"
    };
    bar.setAttribute("aria-valuemax", String(session.total));
    updateBar();
    updateLives(false);
    if (session.queue.length) showQuestion();
    else showDone();
  }

  function updateBar() {
    // In a lesson, the bar follows the questions answered right (a wrong one comes back).
    // In « Mes erreurs », every answer moves it on (nothing comes back).
    const progress = review ? session.answered : session.right;
    const share = session.total ? progress / session.total : 0;
    bar.firstElementChild.style.width = `${Math.max(share * 100, 3)}%`;
    bar.setAttribute("aria-valuenow", String(progress));
  }

  function updateLives(lost) {
    if (!livesEl) return;
    livesEl.textContent = String(session.lives);
    const box = livesEl.parentElement;
    box.setAttribute("aria-label", plural(session.lives, "vie restante", "vies restantes"));
    box.classList.toggle("is-empty", session.lives === 0);
    if (lost) {
      box.classList.remove("is-hit");
      void box.offsetWidth;            // restarts the animation
      box.classList.add("is-hit");
    }
  }

  /** What « Continuer » needs to start again here later. */
  function runState() {
    return {
      right: session.rightIds.slice(),
      first: session.firstTryIds.slice(),
      missed: session.missedIds.slice(),
      lives: session.lives,
      xp: session.xp,
      mistakes: session.mistakes,
    };
  }

  // ---------------------------------------------------------------------------------
  // Questions
  // ---------------------------------------------------------------------------------
  function setMain(label, { enabled = true, tone = "primary" } = {}) {
    const button = actions.querySelector("[data-main]");
    button.textContent = label;
    button.disabled = !enabled;
    button.className = `btn btn--block ${tone === "bad" ? "btn--bad" : "btn--primary"}`;
  }

  function kindHTML(q, label) {
    return `<div class="q-kind"><span class="q-kind__type">${esc(label)}</span>
      ${showRelecture(q) ? `<span class="tag tone-citron q-kind__id" title="Pas encore vérifiée : elle peut contenir des erreurs">À vérifier · ${esc(q.id)}</span>` : ""}
      ${q.example ? `<span class="tag tone-citron" title="Question d’exemple">Exemple</span>` : ""}</div>`;
  }

  function showQuestion() {
    const item = session.queue[0];
    const q = item.q;
    session.phase = "question";
    ui = { item, q };
    bottom.classList.remove("is-right", "is-wrong", "has-feedback");
    setHTML(feedbackEl, "");

    let body = "";
    if (q.type === "qcm") {
      ui.order = shuffle(q.choices.map((_, i) => i));
      ui.selected = new Set();
      ui.multi = q.correct.length > 1;
      body = kindHTML(q, ui.multi ? "Plusieurs réponses possibles" : "Une seule bonne réponse")
        + `<h2 class="q-text" tabindex="-1">${esc(q.text)}</h2>
        <div class="choices${ui.multi ? " is-multi" : ""}" role="group" aria-label="Réponses">${ui.order.map((index) => `
          <button type="button" class="choice" data-choice="${index}" aria-pressed="false">
            <span class="choice__text">${esc(q.choices[index])}</span>
            <span class="choice__mark" aria-hidden="true"></span>
          </button>`).join("")}
        </div>`;
      setMain("Vérifier", { enabled: false });
    } else if (q.type === "saisie") {
      body = kindHTML(q, "Écris ta réponse")
        + `<h2 class="q-text" tabindex="-1">${esc(q.text)}</h2>
        <input class="input input--big q-input" type="text" data-typed placeholder="Ta réponse" aria-label="Ta réponse"
          autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
        ${q.hint ? `<button type="button" class="hint-btn" data-hint aria-expanded="false">${icon("bulb", "icon--s")}Indice</button>
          <p class="hint-box" hidden>${esc(q.hint)}</p>` : ""}`;
      setMain("Vérifier", { enabled: false });
    } else {
      // Two columns in one grid: each row holds a left and a right button, so they line up.
      const lefts = shuffle(q.pairs.map((_, i) => i));
      const rights = shuffle(q.pairs.map((_, i) => i));
      ui.picked = null;
      ui.matched = 0;
      ui.wrongMatches = 0;
      body = kindHTML(q, `Associe les ${q.pairs.length} paires`)
        + `<h2 class="q-text" tabindex="-1">${esc(q.text)}</h2>
        <div class="pairs" data-pairs>${lefts.map((left, row) => `
          <button type="button" class="pair pair--left" data-side="0" data-pair="${left}" aria-pressed="false">${esc(q.pairs[left][0])}</button>
          <button type="button" class="pair" data-side="1" data-pair="${rights[row]}" aria-pressed="false">${esc(q.pairs[rights[row]][1])}</button>`).join("")}
        </div>`;
      setMain(`Associe les ${q.pairs.length} paires`, { enabled: false });
    }

    setHTML(inner, `<div class="question anim-from-right">${body}</div>`);
    stage.scrollTop = 0;
    const input = inner.querySelector("[data-typed]");
    if (input) {
      input.addEventListener("input", () => setMain("Vérifier", { enabled: input.value.trim() !== "" }));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); if (input.value.trim()) check(); }
      });
      // On a laptop, the cursor goes straight into the field. On a phone, the person taps
      // it when ready, so the keyboard doesn't hide the question at once.
      if (window.matchMedia("(pointer: fine)").matches) input.focus({ preventScroll: true });
    } else {
      inner.querySelector(".q-text").focus({ preventScroll: true });
    }
  }

  // ---- Taps inside the question ----------------------------------------------------
  inner.addEventListener("click", (event) => {
    if (session.phase !== "question") return;
    const choice = event.target.closest("[data-choice]");
    const pair = event.target.closest("[data-pair]");
    const hint = event.target.closest("[data-hint]");
    if (choice) pickChoice(choice);
    else if (pair && !pair.disabled) pickPair(pair);
    else if (hint) showHint(hint);
  });

  function pickChoice(button) {
    const index = Number(button.dataset.choice);
    if (ui.multi) {
      if (ui.selected.has(index)) ui.selected.delete(index);
      else ui.selected.add(index);
    } else {
      ui.selected = new Set([index]);
    }
    inner.querySelectorAll("[data-choice]").forEach((b) => {
      b.setAttribute("aria-pressed", String(ui.selected.has(Number(b.dataset.choice))));
    });
    setMain("Vérifier", { enabled: ui.selected.size > 0 });
  }

  function showHint(button) {
    const box = inner.querySelector(".hint-box");
    box.hidden = false;
    box.classList.add("anim-fade-up");
    button.setAttribute("aria-expanded", "true");
    button.disabled = true;
    ui.hintSeen = true;
  }

  function pickPair(button) {
    const picked = ui.picked;
    if (!picked || picked === button) {
      // First pick (or the same button again: unselect it).
      ui.picked = picked === button ? null : button;
      button.setAttribute("aria-pressed", String(ui.picked === button));
      return;
    }
    if (picked.dataset.side === button.dataset.side) {
      // Same column: change the selection.
      picked.setAttribute("aria-pressed", "false");
      ui.picked = button;
      button.setAttribute("aria-pressed", "true");
      return;
    }
    // One on each side: do they go together?
    ui.picked = null;
    picked.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-pressed", "false");
    if (picked.dataset.pair === button.dataset.pair) {
      [picked, button].forEach((b) => { b.classList.add("is-matched"); b.disabled = true; });
      playPair();
      ui.matched++;
      if (ui.matched === ui.q.pairs.length) {
        const q = ui.q;
        setTimeout(() => { if (ui.q === q) check(); }, 350);
      }
    } else {
      ui.wrongMatches++;
      [picked, button].forEach((b) => {
        b.classList.remove("is-miss");
        void b.offsetWidth;
        b.classList.add("is-miss");
        setTimeout(() => b.classList.remove("is-miss"), 650);
      });
      playWrong();
    }
  }

  /** When all the pairs are found, each right button glides next to its left one. */
  function alignPairs() {
    const grid = inner.querySelector("[data-pairs]");
    if (!grid) return;
    const before = new Map([...grid.children].map((el) => [el, el.getBoundingClientRect()]));
    const rights = new Map([...grid.querySelectorAll('[data-side="1"]')].map((b) => [b.dataset.pair, b]));
    [...grid.querySelectorAll('[data-side="0"]')].forEach((left) => {
      grid.appendChild(left);
      grid.appendChild(rights.get(left.dataset.pair));
    });
    grid.classList.add("is-solved");
    // "FLIP" animation: start each button where it was, then let it slide to its new place.
    const moved = [];
    for (const el of grid.children) {
      const from = before.get(el);
      const to = el.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      moved.push(el);
    }
    if (!moved.length) return;
    void grid.offsetWidth;
    moved.forEach((el) => { el.style.transition = ""; el.style.transform = ""; });
  }

  // ---------------------------------------------------------------------------------
  // Check the answer and show the result
  // ---------------------------------------------------------------------------------
  function check() {
    if (closing || session.phase !== "question") return;
    const { q, item } = ui;
    let right = false;
    let note = "";           // extra line: the right answer, or a spelling tip

    if (q.type === "qcm") {
      right = ui.selected.size === q.correct.length && q.correct.every((i) => ui.selected.has(i));
      inner.querySelectorAll("[data-choice]").forEach((b) => {
        const index = Number(b.dataset.choice);
        const isCorrect = q.correct.includes(index);
        const chosen = ui.selected.has(index);
        b.disabled = true;
        if (isCorrect && chosen) b.classList.add("is-right");
        else if (isCorrect) b.classList.add("is-missed");
        else if (chosen) b.classList.add("is-wrong");
        else b.classList.add("is-dim");
        // The round mark: the letter of the file in Relecture (« la réponse C »),
        // otherwise ✓ for a right choice and × for a wrong one.
        const mark = b.querySelector(".choice__mark");
        if (showRelecture(q)) { mark.textContent = LETTERS[index]; b.classList.add("is-lettered"); }
        else if (isCorrect) mark.innerHTML = icon("check");
        else if (chosen) mark.innerHTML = icon("x");
        b.classList.add("is-checked");
      });
      if (!right && showRelecture(q)) {
        const good = q.correct.map((i) => `${LETTERS[i]}. ${q.choices[i]}`);
        note = good.length > 1 ? `Les bonnes réponses : ${good.join(" · ")}` : `La bonne réponse : ${good[0]}`;
      }
    } else if (q.type === "saisie") {
      const input = inner.querySelector("[data-typed]");
      const result = checkTyped(input.value, q.answers);
      right = result.ok;
      input.readOnly = true;
      input.classList.add(right ? "is-right" : "is-wrong");
      if (right && !result.exact) note = `Attention à l’orthographe : ${q.answers[0]}`;
      if (!right) note = `La bonne réponse : ${q.answers[0]}`;
      const hintButton = inner.querySelector("[data-hint]");
      if (hintButton) hintButton.disabled = true;
      input.blur();
    } else {
      right = ui.wrongMatches === 0;
      if (!right) note = `${plural(ui.wrongMatches, "erreur", "erreurs")} en associant. Voici les bonnes paires, côte à côte.`;
      alignPairs();
    }

    session.answered++;
    session.phase = "feedback";
    ui.right = right;
    recordAnswer(q.id, right, { firstTry: item.firstTry, review });

    if (right) {
      session.right++;
      session.rightIds.push(q.id);
      session.missedIds = session.missedIds.filter((id) => id !== q.id);
      if (review) session.xp += XP.review;
      else if (item.firstTry) { session.xp += XP.firstTry; session.firstTryIds.push(q.id); }
      else session.xp += XP.corrected;
      playRight();
    } else {
      session.mistakes++;
      if (!session.missedIds.includes(q.id)) session.missedIds.push(q.id);
      if (!review) {
        session.lives--;
        updateLives(true);
      }
      playWrong();
      const qBox = inner.querySelector(".question");
      qBox.classList.remove("is-shaking");
      void qBox.offsetWidth;
      qBox.classList.add("is-shaking");
    }
    updateBar();
    if (!review) {
      if (session.lives > 0) onProgress(runState());
      else onLost();
    }
    showFeedback(right, note);
  }

  /** In Relecture, what the owner needs to check besides the explanation. */
  function relectureExtrasHTML(q) {
    if (!showRelecture(q) || q.type !== "saisie") return "";
    return `<p class="feedback__extra"><b>Réponses acceptées :</b> ${q.answers.map(esc).join(" · ")}</p>
      <p class="feedback__extra"><b>Indice :</b> ${q.hint ? esc(q.hint) : "aucun"}</p>`;
  }

  function showFeedback(right, note) {
    const q = ui.q;
    const titles = right ? ["Bonne réponse !", "Bien joué !", "Exact !", "Parfait !"] : ["Pas tout à fait", "Raté, pas grave", "Presque !"];
    const title = titles[Math.floor(Math.random() * titles.length)];
    const comeBack = !right && !review && session.lives > 0 ? `<p class="feedback__again">Cette question reviendra à la fin de la leçon.</p>` : "";
    setHTML(feedbackEl, `
      <div class="feedback">
        <p class="feedback__head"><span class="feedback__icon">${icon(right ? "check" : "x")}</span><span>${title}</span></p>
        ${note ? `<p class="feedback__note">${esc(note)}</p>` : ""}
        ${q.explanation ? `<p class="feedback__text">${esc(q.explanation)}</p>` : ""}
        ${relectureExtrasHTML(q)}
        ${q.source ? `<p class="feedback__source">${esc(q.source)}</p>` : ""}
        ${comeBack}
        ${q.study && canStudy(q.study) ? `<button type="button" class="btn btn--small btn--soft tone-lavande" data-study>${icon("book")}Approfondir</button>` : ""}
        ${showRelecture(q) ? `<div class="verdict-slot" data-verdict-slot>${verdictHTML(q)}</div>` : ""}
      </div>`);
    feedbackEl.scrollTop = 0;
    bottom.classList.add("has-feedback", right ? "is-right" : "is-wrong");
    setMain("Continuer", { tone: right ? "primary" : "bad" });
    actions.querySelector("[data-main]").focus({ preventScroll: true });
  }

  feedbackEl.addEventListener("click", (event) => {
    const q = ui.q;
    if (q && showRelecture(q) && handleVerdictTap(event, q, () => {
      const slot = feedbackEl.querySelector("[data-verdict-slot]");
      if (slot && ui.q === q) setHTML(slot, verdictHTML(q));
    })) return;
    if (!event.target.closest("[data-study]")) return;
    const id = q.study;
    close().then(() => onStudy(id));
  });

  // ---------------------------------------------------------------------------------
  // Next question, end of the lesson, lost lesson
  // ---------------------------------------------------------------------------------
  function next() {
    const item = session.queue.shift();
    if (!ui.right && !review) {
      if (session.lives <= 0) return showLost();
      session.queue.push({ q: item.q, firstTry: false });     // comes back at the end
    }
    if (session.queue.length) showQuestion();
    else showDone();
  }

  function showLost() {
    session.phase = "lost";
    bottom.classList.remove("is-right", "is-wrong", "has-feedback");
    setHTML(feedbackEl, "");
    setHTML(inner, `
      <div class="player-end player-end--lost anim-fade-up">
        <div class="player-end__art" aria-hidden="true">${icon("heart", "icon--fill")}</div>
        <h2 class="player-end__title">Plus de vies</h2>
        <p class="player-end__text">Ce n’est pas grave : relis bien les explications, puis recommence la leçon.
          Les questions ratées t’attendent aussi dans « Mes erreurs ».</p>
      </div>`);
    setHTML(actions, `
      <button type="button" class="btn btn--primary btn--block" data-restart>${icon("repeat")}Recommencer la leçon</button>
      <button type="button" class="btn btn--plain btn--block" data-close>Quitter</button>`);
  }

  function showDone() {
    session.phase = "done";
    const perfect = session.mistakes === 0 && !review;
    if (perfect) session.xp += XP.perfect;
    const summary = onFinish({
      xp: session.xp,
      total: session.total,
      firstTryRight: session.firstTryIds.length,
      firstTryIds: session.firstTryIds.slice(),
      questionIds: questions.map((q) => q.id),
      mistakes: session.mistakes,
      perfect,
    }) || { xp: session.xp, streak: 0, streakGrew: false };

    const accuracy = review
      ? Math.round((100 * session.right) / Math.max(1, session.total))
      : Math.round((100 * session.firstTryIds.length) / Math.max(1, session.total));
    const lead = review
      ? (session.mistakes ? `${plural(session.right, "question revue", "questions revues")} sur ${session.total}. Les autres restent à revoir.` : "Tout est juste : ces questions reviendront plus tard pour vérifier que c’est acquis.")
      : (perfect ? `Sans faute ! Bonus de ${XP.perfect} XP.`
        : session.mistakes > 1 ? `${session.mistakes} erreurs corrigées en route : elles sont dans « Mes erreurs ».`
          : "1 erreur corrigée en route : elle est dans « Mes erreurs ».");

    bottom.classList.remove("is-right", "is-wrong", "has-feedback");
    setHTML(feedbackEl, "");
    setHTML(inner, `
      <div class="player-end anim-fade-up">
        <div class="player-end__art player-end__art--win" aria-hidden="true">${icon("award")}</div>
        <h2 class="player-end__title">${review ? "Révision terminée !" : "Leçon terminée !"}</h2>
        <p class="player-end__text">${esc(lead)}</p>
        <div class="end-stats">
          <div class="end-stat end-stat--xp"><b>+${summary.xp}</b><span>XP</span></div>
          <div class="end-stat end-stat--acc"><b>${accuracy} %</b><span>${review ? "de bonnes réponses" : "du premier coup"}</span></div>
          <div class="end-stat end-stat--streak${summary.streakGrew ? " is-new" : ""}"><b>${summary.streak}</b><span>${summary.streak > 1 ? "jours de série" : "jour de série"}</span></div>
        </div>
        ${summary.streakGrew ? `<p class="streak-note">${icon("flame", "icon--fill")}${summary.streak > 1 ? `Ta série passe à ${summary.streak} jours !` : "Ta série commence aujourd’hui !"}</p>` : ""}
        <p class="player-end__title-small">${esc(heading ? `${title} · ${heading}` : title)}</p>
      </div>`);
    setHTML(actions, `<button type="button" class="btn btn--primary btn--block" data-close>Continuer</button>`);
    playWin();
    launchConfetti(root);
    actions.querySelector("[data-close]").focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------------------------
  // Buttons at the bottom, keyboard, closing
  // ---------------------------------------------------------------------------------
  root.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) requestClose();
    else if (event.target.closest("[data-restart]")) {
      setHTML(actions, `<button type="button" class="btn btn--primary btn--block" data-main disabled>Vérifier</button>`);
      start();
    } else if (event.target.closest("[data-main]")) {
      if (session.phase === "question") check();
      else if (session.phase === "feedback") next();
    }
  });

  function onKey(event) {
    if (hasOpenSheet() || event.defaultPrevented) return;
    if (event.key === "Escape") { event.preventDefault(); requestClose(); return; }
    const typing = event.target && event.target.matches && event.target.matches("input, textarea");
    if (session.phase === "question" && ui.q.type === "qcm" && !typing && KEYS.includes(event.key)) {
      const button = inner.querySelectorAll("[data-choice]")[Number(event.key) - 1];
      if (button) { event.preventDefault(); pickChoice(button); }
    } else if (event.key === "Enter" && !typing) {
      const main = actions.querySelector("[data-main], [data-close]");
      if (main && !main.disabled && document.activeElement !== main) { event.preventDefault(); main.click(); }
    }
  }
  document.addEventListener("keydown", onKey);

  /** A review in progress asks before stopping (its XP would be lost). A lesson is kept. */
  const mustAsk = () => review && session.answered > 0 && (session.phase === "question" || session.phase === "feedback");

  function requestClose() {
    if (mustAsk()) askToLeave();
    else close();
  }

  function askToLeave() {
    const sheet = openSheet({
      title: "Arrêter la révision ?",
      address: "arreter",
      body: `<p class="sheet-text">Tes réponses sont déjà enregistrées. Les XP de cette révision seront perdus.</p>
        <div class="sheet__actions">
          <button type="button" class="btn btn--primary btn--block" data-stay>Continuer la révision</button>
          <button type="button" class="btn btn--danger btn--block" data-leave>Arrêter</button>
        </div>`,
    });
    sheet.body.addEventListener("click", (event) => {
      if (event.target.closest("[data-stay]")) sheet.close();
      else if (event.target.closest("[data-leave]")) sheet.close().then(() => close());
    });
  }

  // The lesson is a "modal" of nav.js: it has its address, and « back » closes it.
  const modal = openModal({
    key: address[0],
    value: address[1] || "",
    close: () => finishClose(),
    beforePop: () => !mustAsk(),
    onRefuse: () => askToLeave(),
  });

  /** Closes the player through the history (like « back »). */
  function close() {
    return new Promise((resolve) => {
      if (closing) return resolve();
      waiting.push(resolve);
      closeModal(modal);
    });
  }
  const waiting = [];

  function finishClose() {
    if (closing) return;
    closing = true;
    forgetModal(modal);
    destroy();
    if (onClose) onClose();
    waiting.splice(0).forEach((resolve) => resolve());
  }

  function destroy() {
    closing = true;
    document.removeEventListener("keydown", onKey);
    document.documentElement.classList.remove("has-player");
    const app = document.getElementById("app");
    if (app) app.inert = false;
    root.classList.remove("is-open");
    setTimeout(() => root.remove(), 420);
    if (current && current.root === root) current = null;
  }

  // ---- Go ----------------------------------------------------------------------------
  document.documentElement.classList.add("has-player");
  current = { root, destroy };
  start(run);
  requestAnimationFrame(() => {
    root.classList.add("is-open");
    const app = document.getElementById("app");
    setTimeout(() => { if (app && current && current.root === root) app.inert = true; }, 420);
  });
  return { close };
}

/** Is a lesson open now? (app.js waits before refreshing the content) */
export function isPlaying() {
  return Boolean(current);
}
