/* =====================================================================================
   player.js: the screen of a lesson (or of « Mes erreurs »), over the whole app.

   How a lesson goes:
     1. The questions come in a random order (and the choices of a QCM too).
     2. The person answers, taps « Vérifier », and sees straight away if it is right,
        with a one-sentence explanation.
     3. A wrong answer costs one of the 3 lives, and the question comes back at the end
        of the lesson. Losing all 3 lives restarts the lesson.
     4. When every question has been answered right, the lesson is finished: XP, série,
        a little celebration.
   In « Mes erreurs » there are no lives, and a wrong answer simply stays to review.

   Every answer is saved straight away (progress.js), so a mistake goes into
   « Mes erreurs » even if the lesson is left before the end.
   ===================================================================================== */

import { esc, icon, setHTML } from "../core/dom.js";
import { openSheet, hasOpenSheet } from "../core/sheet.js";
import { checkTyped } from "./answer.js";
import { recordAnswer, XP } from "./progress.js";
import { playRight, playWrong, playPair, playWin } from "./sound.js";
import { launchConfetti } from "./confetti.js";

const LIVES = 3;
const KEYS = ["1", "2", "3", "4", "5", "6"];
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
 *   title       « Anatomie et mouvement · Leçon 1 » (shown on the end screen)
 *   questions   the questions (from content.js)
 *   review      true for « Mes erreurs »: no lives, nothing comes back at the end
 *   onFinish    function(result) called when everything is answered; it saves the
 *               session and returns { xp, xpTotal, streak, streakGrew } for the end screen
 *   onClose     function() called once the player is closed
 *   canStudy    function(studyId): true if a study page exists (« Approfondir »)
 *   onStudy     function(studyId): opens that study page
 */
export function openPlayer({ title, questions, review = false, onFinish, onClose,
  canStudy = () => false, onStudy = () => {} }) {
  if (current) current.destroy();

  const root = document.createElement("div");
  root.className = "player";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", review ? "Révision de tes erreurs" : `Leçon : ${title}`);
  setHTML(root, `
    <div class="player__top">
      <button type="button" class="icon-btn player__close" data-close aria-label="Quitter">${icon("close")}</button>
      <div class="player__bar" role="progressbar" aria-label="Avancement" aria-valuemin="0"><i></i></div>
      ${review
        ? `<span class="player__tag">${icon("repeat", "icon--s")}Mes erreurs</span>`
        : `<span class="player__lives" aria-live="polite"><svg class="icon icon--heart" aria-hidden="true"><use href="#i-heart"/></svg><b></b></span>`}
    </div>
    <div class="player__stage"><div class="player__inner"></div></div>
    <div class="player__bottom">
      <div class="player__feedback" aria-live="assertive"></div>
      <div class="player__actions">
        <button type="button" class="btn btn--primary btn--block btn--big" data-main disabled>Vérifier</button>
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
  const historyId = `player-${Date.now()}`;

  // ---------------------------------------------------------------------------------
  // Start (and restart after losing all the lives)
  // ---------------------------------------------------------------------------------
  function start() {
    session = {
      queue: shuffle(questions).map((q) => ({ q, firstTry: true })),
      total: questions.length,
      right: 0,              // questions answered right (at least once)
      firstTryRight: 0,
      mistakes: 0,
      answered: 0,
      lives: LIVES,
      xp: 0,
      phase: "question",     // "question", "feedback", "lost" or "done"
    };
    bar.setAttribute("aria-valuemax", String(session.total));
    updateBar();
    updateLives(false);
    showQuestion();
  }

  function updateBar() {
    const share = session.total ? session.right / session.total : 0;
    bar.firstElementChild.style.width = `${Math.max(share * 100, 4)}%`;
    bar.setAttribute("aria-valuenow", String(session.right));
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

  // ---------------------------------------------------------------------------------
  // Questions
  // ---------------------------------------------------------------------------------
  function setMain(label, { enabled = true, tone = "primary" } = {}) {
    const button = actions.querySelector("[data-main]");
    button.textContent = label;
    button.disabled = !enabled;
    button.className = `btn btn--block btn--big btn--${tone}`;
  }

  function kindHTML(q, label, iconName) {
    return `<p class="q-kind">${icon(iconName, "icon--s")}<span>${esc(label)}</span>
      ${q.example ? `<span class="badge badge--warn" title="Question d’exemple, pas encore vérifiée">Exemple</span>` : ""}</p>`;
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
      body = kindHTML(q, ui.multi ? "Plusieurs réponses possibles" : "Une seule bonne réponse",
        ui.multi ? "layers" : "check")
        + `<h2 class="q-text" tabindex="-1">${esc(q.text)}</h2>
        <div class="choices" role="group" aria-label="Réponses">${ui.order.map((index, position) => `
          <button type="button" class="choice" data-choice="${index}" aria-pressed="false">
            <span class="choice__key" aria-hidden="true">${ui.multi ? icon("check", "icon--s") : position + 1}</span>
            <span class="choice__text">${esc(q.choices[index])}</span>
          </button>`).join("")}
        </div>`;
      setMain("Vérifier", { enabled: false });
    } else if (q.type === "saisie") {
      body = kindHTML(q, "Écris ta réponse", "sparkles")
        + `<h2 class="q-text" tabindex="-1">${esc(q.text)}</h2>
        <input class="input q-input" type="text" data-typed placeholder="Ta réponse" aria-label="Ta réponse"
          autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
        ${q.hint ? `<button type="button" class="hint-btn" data-hint aria-expanded="false">${icon("bulb", "icon--s")}Indice</button>
          <p class="hint-box" hidden>${esc(q.hint)}</p>` : ""}`;
      setMain("Vérifier", { enabled: false });
    } else {
      const lefts = shuffle(q.pairs.map((_, i) => i));
      const rights = shuffle(q.pairs.map((_, i) => i));
      ui.picked = null;
      ui.matched = 0;
      ui.wrongMatches = 0;
      body = kindHTML(q, `Associe les ${q.pairs.length} paires`, "layers")
        + `<h2 class="q-text" tabindex="-1">${esc(q.text)}</h2>
        <div class="pairs">
          <div class="pairs__col">${lefts.map((i) => `<button type="button" class="pair pair--left" data-side="0" data-pair="${i}" aria-pressed="false">${esc(q.pairs[i][0])}</button>`).join("")}</div>
          <div class="pairs__col">${rights.map((i) => `<button type="button" class="pair" data-side="1" data-pair="${i}" aria-pressed="false">${esc(q.pairs[i][1])}</button>`).join("")}</div>
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
      if (ui.matched === ui.q.pairs.length) setTimeout(check, 350);
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

  // ---------------------------------------------------------------------------------
  // Check the answer and show the result
  // ---------------------------------------------------------------------------------
  function check() {
    if (session.phase !== "question") return;
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
      });
      if (!right) {
        const good = q.correct.map((i) => q.choices[i]);
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
      if (!right) note = `${plural(ui.wrongMatches, "erreur", "erreurs")} en associant. Toutes les paires sont maintenant en vert.`;
    }

    session.answered++;
    session.phase = "feedback";
    ui.right = right;
    recordAnswer(q.id, right, { firstTry: item.firstTry, review });

    if (right) {
      session.right++;
      if (review) session.xp += XP.review;
      else if (item.firstTry) { session.xp += XP.firstTry; session.firstTryRight++; }
      else session.xp += XP.corrected;
      updateBar();
      playRight();
    } else {
      session.mistakes++;
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
    showFeedback(right, note);
  }

  function showFeedback(right, note) {
    const q = ui.q;
    const titles = right ? ["Bonne réponse !", "Bien joué !", "Exact !", "Parfait !"] : ["Pas tout à fait", "Raté, pas grave", "Presque !"];
    const title = titles[Math.floor(Math.random() * titles.length)];
    const comeBack = !right && !review && session.lives > 0 ? "<p class=\"feedback__again\">Cette question reviendra à la fin de la leçon.</p>" : "";
    setHTML(feedbackEl, `
      <div class="feedback anim-fade-up">
        <p class="feedback__title">${icon(right ? "check" : "close")}<span>${title}</span></p>
        ${note ? `<p class="feedback__note">${esc(note)}</p>` : ""}
        ${q.explanation ? `<p class="feedback__text">${esc(q.explanation)}</p>` : ""}
        ${q.source ? `<p class="feedback__source">Source : ${esc(q.source)}</p>` : ""}
        ${comeBack}
        ${q.study && canStudy(q.study) ? `<button type="button" class="btn btn--small btn--secondary" data-study>${icon("etudier")}Approfondir</button>` : ""}
      </div>`);
    bottom.classList.add("has-feedback", right ? "is-right" : "is-wrong");
    setMain("Continuer", { tone: right ? "primary" : "bad" });
    actions.querySelector("[data-main]").focus({ preventScroll: true });
  }

  feedbackEl.addEventListener("click", (event) => {
    if (!event.target.closest("[data-study]")) return;
    const id = ui.q.study;
    requestClose({ force: true }).then(() => onStudy(id));
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
        <div class="player-end__art" aria-hidden="true"><svg class="icon"><use href="#i-heart"/></svg></div>
        <h2 class="player-end__title">Plus de vies</h2>
        <p class="player-end__text">Ce n’est pas grave : relis bien les explications, puis recommence la leçon.
          Les questions ratées t’attendent aussi dans « Mes erreurs ».</p>
      </div>`);
    setHTML(actions, `
      <button type="button" class="btn btn--primary btn--block btn--big" data-restart>${icon("repeat")}Recommencer la leçon</button>
      <button type="button" class="btn btn--plain btn--block" data-close>Quitter</button>`);
  }

  function showDone() {
    session.phase = "done";
    const perfect = session.mistakes === 0 && !review;
    if (perfect) session.xp += XP.perfect;
    const summary = onFinish({
      xp: session.xp,
      total: session.total,
      firstTryRight: session.firstTryRight,
      mistakes: session.mistakes,
      perfect,
    }) || { xp: session.xp, streak: 0, streakGrew: false };

    const accuracy = review
      ? Math.round((100 * session.right) / Math.max(1, session.total))
      : Math.round((100 * session.firstTryRight) / Math.max(1, session.total));
    const lead = review
      ? (session.mistakes ? `${plural(session.right, "question revue", "questions revues")} sur ${session.total}. Les autres restent à revoir.` : "Tout est juste : ces questions reviendront plus tard pour vérifier que c’est acquis.")
      : (perfect ? "Sans faute ! Bonus de " + XP.perfect + " XP." : `${plural(session.mistakes, "erreur corrigée", "erreurs corrigées")} en route : elles sont dans « Mes erreurs ».`);

    bottom.classList.remove("is-right", "is-wrong", "has-feedback");
    setHTML(feedbackEl, "");
    setHTML(inner, `
      <div class="player-end anim-fade-up">
        <div class="player-end__art player-end__art--win" aria-hidden="true"><svg class="icon"><use href="#i-award"/></svg></div>
        <h2 class="player-end__title">${review ? "Révision terminée !" : "Leçon terminée !"}</h2>
        <p class="player-end__text">${esc(lead)}</p>
        <div class="end-stats">
          <div class="end-stat end-stat--xp"><b>+${summary.xp}</b><span>XP</span></div>
          <div class="end-stat end-stat--acc"><b>${accuracy} %</b><span>${review ? "de bonnes réponses" : "du premier coup"}</span></div>
          <div class="end-stat end-stat--streak${summary.streakGrew ? " is-new" : ""}"><b>${summary.streak}</b><span>${summary.streak > 1 ? "jours de série" : "jour de série"}</span></div>
        </div>
        ${summary.streakGrew ? `<p class="streak-note">${icon("flame")}${summary.streak > 1 ? `Ta série passe à ${summary.streak} jours !` : "Ta série commence aujourd’hui !"}</p>` : ""}
        <p class="player-end__title-small">${esc(title)}</p>
      </div>`);
    setHTML(actions, `<button type="button" class="btn btn--primary btn--block btn--big" data-close>Continuer</button>`);
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
      setHTML(actions, `<button type="button" class="btn btn--primary btn--block btn--big" data-main disabled>Vérifier</button>`);
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

  /** In the middle of a lesson, ask before leaving. */
  function requestClose({ force = false } = {}) {
    const inProgress = session.answered > 0 && (session.phase === "question" || session.phase === "feedback");
    if (force || !inProgress) return close();
    return new Promise((resolve) => {
      const sheet = openSheet({
        title: review ? "Arrêter la révision ?" : "Quitter la leçon ?",
        body: `<p class="sheet-text">${review
          ? "Tes réponses sont déjà enregistrées. Les XP de cette révision seront perdus."
          : "Ta progression dans cette leçon sera perdue. Les erreurs déjà faites restent dans « Mes erreurs »."}</p>
          <div class="sheet__actions">
            <button type="button" class="btn btn--primary btn--block" data-stay>${review ? "Continuer la révision" : "Continuer la leçon"}</button>
            <button type="button" class="btn btn--danger btn--block" data-leave>Quitter</button>
          </div>`,
      });
      sheet.body.addEventListener("click", (event) => {
        if (event.target.closest("[data-stay]")) sheet.close().then(resolve);
        else if (event.target.closest("[data-leave]")) sheet.close().then(() => close()).then(resolve);
      });
    });
  }

  // The « back » button of Android (or of the browser) asks to leave too.
  history.pushState({ playerId: historyId }, "");
  function onPop() {
    if (closing) return;
    if (history.state && history.state.playerId === historyId) return;  // a sheet above closed
    if (hasOpenSheet()) return;
    const inProgress = session.answered > 0 && (session.phase === "question" || session.phase === "feedback");
    if (inProgress) {
      history.pushState({ playerId: historyId }, "");   // stay, and ask
      requestClose();
    } else {
      finishClose();
    }
  }
  window.addEventListener("popstate", onPop);

  function close() {
    return new Promise((resolve) => {
      if (closing) return resolve();
      closing = true;
      if (history.state && history.state.playerId === historyId) {
        const done = () => { window.removeEventListener("popstate", done); finishClose(); resolve(); };
        window.addEventListener("popstate", done);
        history.back();
      } else {
        finishClose();
        resolve();
      }
    });
  }

  function finishClose() {
    closing = true;
    destroy();
    if (onClose) onClose();
  }

  function destroy() {
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("popstate", onPop);
    document.documentElement.classList.remove("has-player");
    root.classList.remove("is-open");
    setTimeout(() => root.remove(), 380);
    if (current && current.root === root) current = null;
  }

  // ---- Go ----------------------------------------------------------------------------
  document.documentElement.classList.add("has-player");
  current = { root, destroy };
  start();
  requestAnimationFrame(() => root.classList.add("is-open"));
  return { close: () => requestClose({ force: true }) };
}

/** Is a lesson open now? (app.js waits before refreshing the content) */
export function isPlaying() {
  return Boolean(current);
}
