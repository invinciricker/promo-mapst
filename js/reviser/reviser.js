/* =====================================================================================
   reviser.js: the Réviser tab.

     #reviser            the home of Réviser: série, XP, « Continuer », « Mes erreurs »,
                         and the list of themes
     #reviser/<theme>    one theme: its lessons, as a path to follow (they unlock in order)

   The lesson itself opens over the app (player.js). What is remembered (XP, série,
   questions done, mistakes) is in progress.js, the questions in content.js, and the
   « Mode relecture » in relecture.js.
   ===================================================================================== */

import { esc, icon, setHTML } from "../core/dom.js";
import { go } from "../core/router.js";
import { openSheet } from "../core/sheet.js";
import { showToast } from "../core/toast.js";
import { footerHTML } from "../core/texts.js";
import { openPlayer, isPlaying } from "./player.js";
import { soundOn, setSoundOn } from "./sound.js";
import { verdictFor, relectureSummary } from "./relecture.js";
import { XP, xpTotal, xpToday, streak, lessonInfo, isUnlocked, themeProgress, currentLesson,
  nextLesson, mistakes, daysUntil, finishSession } from "./progress.js";

const REVIEW_SIZE = 10;            // questions per « Mes erreurs » session

// What is on screen now (the tab is drawn again each time it is shown).
const view = {
  container: null,
  content: null,
  themeId: null,     // theme shown now (null: the home of Réviser)
  justDone: null,    // lesson just finished: the next one gets a little animation
  pushed: null,      // theme opened from the list of themes (« Tous les thèmes » goes back)
};

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const minutesFor = (count) => Math.max(1, Math.round((count * 35) / 60));   // ~35 s a question

/** « Leçon 1 · Os et articulations », or « Leçon 1 » when the lesson has no title. */
export function lessonHeading(lesson) {
  return lesson.title ? `Leçon ${lesson.number} · ${lesson.title}` : `Leçon ${lesson.number}`;
}

/** In Relecture: how many unchecked questions of a list already have a verdict. */
function checkedCount(questions) {
  return questions.filter((q) => q.draft && verdictFor(q)).length;
}

/**
 * Draws the Réviser tab.
 *   container  the <section> of the screen
 *   content    from content.js (themes, lessons, questions)
 *   themeId    the theme to show, or null for the home of Réviser
 */
export function renderReviser(container, content, themeId = null) {
  view.container = container;
  view.content = content;
  view.themeId = themeId && content.theme(themeId) ? themeId : null;
  if (!container.dataset.bound) {
    container.addEventListener("click", onClick);
    container.dataset.bound = "1";
  }
  if (view.themeId) renderTheme(container, content, content.theme(view.themeId));
  else renderHome(container, content);
  view.justDone = null;
}

/** Draws the tab again (after a lesson, or when new questions arrive). */
export function refreshReviser(content) {
  if (content) view.content = content;
  if (view.container && !view.container.hidden && !isPlaying()) {
    renderReviser(view.container, view.content, view.themeId);
  }
}

// -------------------------------------------------------------------------------------
// Pieces
// -------------------------------------------------------------------------------------
function statsHTML() {
  const s = streak();
  return `<div class="rv-stats">
      <div class="rv-stat rv-stat--streak${s.count ? "" : " is-cold"}">
        <span class="rv-stat__icon">${icon("flame")}</span>
        <span class="rv-stat__text"><b>${s.count}</b><span>${s.count > 1 ? "jours de série" : "jour de série"}</span></span>
      </div>
      <div class="rv-stat rv-stat--xp">
        <span class="rv-stat__icon">${icon("reviser")}</span>
        <span class="rv-stat__text"><b>${xpTotal()}</b><span>XP au total</span></span>
      </div>
      <div class="rv-stat rv-stat--today">
        <span class="rv-stat__icon">${icon("sun")}</span>
        <span class="rv-stat__text"><b>${xpToday()}</b><span>XP du jour</span></span>
      </div>
    </div>
    ${s.atRisk ? `<p class="rv-nudge">${icon("flame", "icon--s")}Fais une leçon aujourd’hui pour garder ta série de ${plural(s.count, "jour", "jours")}.</p>` : ""}`;
}

function examplesNote(content) {
  return content.hasExamples
    ? `<div class="note-box">${icon("alert")}<p><b>Questions d’exemple.</b> Les vraies questions arrivent bientôt, vérifiées avec les cours. Les exemples portent le badge « Exemple ».</p></div>`
    : "";
}

/** In « Mode relecture »: where the checking stands, and the way to the report. */
function relectureCard(content) {
  if (!content.relecture) return "";
  const s = relectureSummary(content);
  return `<button type="button" class="card rv-relecture" data-report>
      <span class="rv-relecture__icon">${icon("clipboard")}</span>
      <span class="rv-relecture__body">
        <span class="rv-relecture__title">Mode relecture</span>
        <span class="rv-relecture__text">${s.total
          ? `${s.checked} sur ${s.total} relues${s.corriger.length ? ` · ${s.corriger.length} à corriger` : ""}`
          : "Aucune question à vérifier pour l’instant"}</span>
        ${s.total ? progressBar(s.checked / s.total, `${s.checked} questions relues sur ${s.total}`) : ""}
      </span>
      <span class="rv-relecture__end">Rapport${icon("right", "icon--s")}</span>
    </button>`;
}

function progressBar(share, label) {
  const percent = Math.round(Math.max(0, Math.min(1, share)) * 100);
  return `<span class="rv-progress" role="img" aria-label="${esc(label)}"><i style="width:${percent}%"></i></span>`;
}

const preparingText = "Chaque question est relue avec les cours avant d’apparaître ici. Reviens bientôt !";

// -------------------------------------------------------------------------------------
// Home of Réviser
// -------------------------------------------------------------------------------------
function renderHome(container, content) {
  const next = nextLesson(content);
  const errors = mistakes(content);
  const nothing = !content.total;

  let hero;
  if (nothing) {
    hero = `<div class="rv-next rv-next--soon">
        <p class="rv-next__label">Questions en préparation</p>
        <p class="rv-next__title">Les leçons arrivent bientôt</p>
        <p class="rv-next__meta">${preparingText}</p></div>`;
  } else if (next) {
    const started = xpTotal() > 0 || next.theme.lessons.some((l) => lessonInfo(l).started);
    const count = next.lesson.questions.length;
    hero = `<div class="rv-next">
        <p class="rv-next__label">${started ? "Continuer" : "Pour commencer"}</p>
        <p class="rv-next__title">${esc(next.theme.title)}</p>
        <p class="rv-next__meta"><b>${esc(lessonHeading(next.lesson))}</b><br>${plural(count, "question", "questions")} · environ ${minutesFor(count)} min</p>
        <button type="button" class="btn btn--primary btn--block btn--big" data-start="${esc(next.lesson.key)}">${icon("reviser")}${started ? "Continuer" : "Commencer"}</button>
      </div>`;
  } else {
    hero = `<div class="rv-next"><p class="rv-next__label">Bravo</p>
        <p class="rv-next__title">Toutes les leçons sont faites</p>
        <p class="rv-next__meta">Revois tes erreurs, ou refais une leçon pour gagner des XP.</p></div>`;
  }
  const showStats = !nothing || xpTotal() > 0;

  let errorsCard;
  if (errors.due.length) {
    const count = Math.min(errors.due.length, REVIEW_SIZE);
    errorsCard = `<button type="button" class="card rv-errors" data-review>
        <span class="rv-errors__icon">${icon("repeat")}</span>
        <span class="rv-errors__body">
          <span class="rv-errors__title">${plural(errors.due.length, "question à revoir", "questions à revoir")}</span>
          <span class="rv-errors__text">${errors.due.length > REVIEW_SIZE ? `Une révision de ${count} questions, ` : ""}sans vies : prends ton temps.</span>
        </span>
        ${icon("right")}
      </button>`;
  } else if (errors.all) {
    const wait = errors.nextDue ? daysUntil(errors.nextDue) : 1;
    errorsCard = `<div class="card rv-errors is-calm">
        <span class="rv-errors__icon">${icon("check")}</span>
        <span class="rv-errors__body">
          <span class="rv-errors__title">Rien à revoir aujourd’hui</span>
          <span class="rv-errors__text">${plural(errors.all, "question revient", "questions reviennent")} ${wait <= 1 ? "demain" : `dans ${wait} jours`}, pour vérifier que c’est acquis.</span>
        </span>
      </div>`;
  } else {
    errorsCard = `<div class="card rv-errors is-calm">
        <span class="rv-errors__icon">${icon("sparkles")}</span>
        <span class="rv-errors__body">
          <span class="rv-errors__title">Aucune erreur pour l’instant</span>
          <span class="rv-errors__text">Chaque question ratée viendra ici, et reviendra jusqu’à ce qu’elle soit acquise.</span>
        </span>
      </div>`;
  }

  const themes = content.themes.map((theme) => {
    const p = themeProgress(theme);
    const complete = p.total > 0 && p.done === p.total;
    const drafts = theme.lessons.flatMap((l) => l.questions.filter((q) => q.draft));
    const relu = content.relecture && drafts.length ? ` · ${checkedCount(drafts)}/${drafts.length} relues` : "";
    return `<button type="button" class="card rv-theme${complete ? " is-complete" : ""}${p.total ? "" : " is-soon"}" data-theme="${esc(theme.id)}">
        <span class="rv-theme__num">${complete ? icon("check") : theme.index}</span>
        <span class="rv-theme__body">
          <span class="rv-theme__title">${esc(theme.title)}</span>
          <span class="rv-theme__meta">${p.total
            ? `${plural(p.total, "leçon", "leçons")} · ${plural(theme.questionCount, "question", "questions")}${relu}`
            : "Questions en préparation"}</span>
          ${p.total ? progressBar(p.share, `${p.done} leçons terminées sur ${p.total}`) : ""}
        </span>
        <span class="rv-theme__end">${p.total ? `${p.done}/${p.total}` : icon("clock", "icon--s")}</span>
      </button>`;
  }).join("");

  setHTML(container, `
    <div class="wrap screen__body">
      <section class="card card--float rv-hero">${showStats ? statsHTML() : ""}${hero}</section>
      ${relectureCard(content)}
      ${examplesNote(content)}
      ${nothing && !errors.all ? "" : `<section class="section">
        <div class="section__head"><h2 class="section__title">Mes erreurs</h2>
          ${errors.all ? `<span class="section__aside">${plural(errors.all, "question", "questions")} en tout</span>` : ""}</div>
        ${errorsCard}
      </section>`}
      <section class="section">
        <div class="section__head"><h2 class="section__title">Les thèmes</h2><span class="section__aside">${plural(content.themes.length, "thème", "thèmes")}</span></div>
        <div class="rv-themes">${themes}</div>
      </section>
      <div class="rv-tools">
        <button type="button" class="btn btn--secondary btn--small" data-how>${icon("info")}Comment ça marche</button>
        <button type="button" class="btn btn--secondary btn--small" data-sound aria-pressed="${soundOn()}">${icon(soundOn() ? "volume" : "mute")}Sons ${soundOn() ? "activés" : "coupés"}</button>
      </div>
      ${footerHTML()}
    </div>`);
}

// -------------------------------------------------------------------------------------
// One theme: the path of its lessons
// -------------------------------------------------------------------------------------
const SHIFTS = [0, 46, 70, 46, 0, -46, -70, -46];   // the zigzag of the path, in pixels

function renderTheme(container, content, theme) {
  const relecture = content.relecture;
  const p = themeProgress(theme);
  const current = currentLesson(theme, relecture);
  const doneKeys = theme.lessons.filter((l) => lessonInfo(l).complete).map((l) => l.key);
  const freshKey = view.justDone && current && doneKeys.includes(view.justDone) ? current.key : null;

  let action = "";
  if (current) {
    const info = lessonInfo(current);
    action = `<button type="button" class="btn btn--primary btn--block btn--big" data-start="${esc(current.key)}">${icon("reviser")}${info.fresh ? "Voir les nouvelles questions" : `Commencer la leçon ${current.number}`}</button>`;
  } else if (theme.lessons.length) {
    action = `<button type="button" class="btn btn--secondary btn--block btn--big" data-start="${esc(theme.lessons[0].key)}">${icon("repeat")}Refaire la leçon ${theme.lessons[0].number}</button>
      <p class="rv-themehead__done">${icon("check", "icon--s")}Toutes les leçons de ce thème sont faites.</p>`;
  }

  const steps = theme.lessons.map((lesson, i) => {
    const info = lessonInfo(lesson);
    const unlocked = isUnlocked(theme, lesson, relecture);
    const state = info.complete ? "done" : lesson === current ? "current" : unlocked ? "open" : "locked";
    const label = `Leçon ${lesson.number}${lesson.title ? `, ${lesson.title}` : ""}, ${{
      done: `terminée${info.score ? `, ${info.score} % du premier coup` : ""}`,
      current: info.fresh ? "nouvelles questions" : "à faire",
      open: info.fresh ? "nouvelles questions" : "ouverte",
      locked: "verrouillée",
    }[state]}`;
    const relu = relecture && lesson.draftCount
      ? `<span class="path__relu${checkedCount(lesson.questions) === lesson.draftCount ? " is-done" : ""}">${checkedCount(lesson.questions)}/${lesson.draftCount} relues</span>`
      : "";
    return `<li class="path__step is-${state}${lesson.key === freshKey ? " is-new" : ""}" style="--shift:${SHIFTS[i % SHIFTS.length]}px">
        ${state === "current" ? `<span class="path__bubble" aria-hidden="true">${info.fresh ? "Nouveau" : "Commencer"}</span>` : ""}
        <button type="button" class="path__node" data-lesson="${esc(lesson.key)}" aria-label="${esc(label)}"${state === "locked" ? ' aria-disabled="true"' : ""}>
          ${icon(state === "done" ? "check" : state === "locked" ? "lock" : "reviser")}
        </button>
        <span class="path__label"><span class="path__num">Leçon ${lesson.number}</span>${lesson.title ? `<span class="path__title">${esc(lesson.title)}</span>` : ""}${relu}</span>
      </li>`;
  }).join("");

  setHTML(container, `
    <div class="wrap screen__body">
      <section class="card card--float rv-themehead">
        <button type="button" class="rv-back" data-back>${icon("left", "icon--s")}Tous les thèmes</button>
        <p class="rv-eyebrow">Thème ${theme.index} sur ${content.themes.length}</p>
        <h2 class="rv-themehead__title">${esc(theme.title)}</h2>
        ${p.total ? `<div class="rv-themehead__progress">${progressBar(p.share, `${p.done} leçons terminées sur ${p.total}`)}<span>${p.done}/${plural(p.total, "leçon", "leçons")}</span></div>` : ""}
        ${action}
      </section>
      ${relectureCard(content)}
      ${examplesNote(content)}
      ${theme.lessons.length ? `<section class="section">
        <div class="section__head"><h2 class="section__title">Le parcours</h2>
          <span class="section__aside">${plural(theme.questionCount, "question", "questions")}</span></div>
        <ol class="path">${steps}</ol>
      </section>` : `<div class="card empty rv-soon">${icon("clock")}<p><b>Questions en préparation</b></p>
        <p>${preparingText}</p></div>`}
      ${footerHTML()}
    </div>`);

  const fresh = container.querySelector(".path__step.is-new");
  if (fresh) fresh.scrollIntoView({ block: "center", behavior: "smooth" });
}

// -------------------------------------------------------------------------------------
// Taps
// -------------------------------------------------------------------------------------
function onClick(event) {
  const content = view.content;
  const target = event.target;
  const start = target.closest("[data-start]");
  const themeButton = target.closest("[data-theme]");
  const node = target.closest("[data-lesson]");

  if (start) startLesson(content.lesson(start.dataset.start));
  else if (themeButton) {
    view.pushed = themeButton.dataset.theme;      // so « Tous les thèmes » can go back
    go("reviser", themeButton.dataset.theme, { push: true });
    window.scrollTo(0, 0);
  } else if (node) openLessonSheet(node.dataset.lesson);
  else if (target.closest("[data-back]")) {
    // Came from the list of themes: go back in the history (like the phone's back button).
    // Came from somewhere else (the planning, a link): open the list of themes.
    if (view.pushed === view.themeId) history.back();
    else go("reviser");
    view.pushed = null;
  } else if (target.closest("[data-review]")) startReview();
  else if (target.closest("[data-report]")) {
    go("infos", "relecture", { push: true });
    window.scrollTo(0, 0);
  } else if (target.closest("[data-how]")) openHowSheet();
  else if (target.closest("[data-sound]")) {
    setSoundOn(!soundOn());
    showToast(soundOn() ? "Sons et vibrations activés" : "Sons et vibrations coupés");
    refreshReviser();
  }
}

function startLesson(lesson) {
  if (!lesson) return;
  const theme = view.content.theme(lesson.theme);
  openPlayer({
    title: theme.title,
    heading: lessonHeading(lesson),
    questions: lesson.questions,
    onFinish: (result) => {
      view.justDone = lesson.key;
      return finishSession({
        kind: "lesson", themeId: theme.id, xp: result.xp,
        questionIds: result.questionIds, firstTryIds: result.firstTryIds,
      });
    },
    onClose: () => {
      if (view.justDone === lesson.key && view.themeId !== theme.id) {
        // Finished from the home of Réviser: show its theme, with the next lesson unlocked.
        view.pushed = theme.id;
        go("reviser", theme.id, { push: true });
        window.scrollTo(0, 0);
      } else {
        refreshReviser();
      }
    },
  });
}

function startReview() {
  const due = mistakes(view.content).due.slice(0, REVIEW_SIZE);
  if (!due.length) return;
  openPlayer({
    title: "Mes erreurs",
    questions: due,
    review: true,
    onFinish: (result) => finishSession({ kind: "review", xp: result.xp }),
    onClose: () => refreshReviser(),
  });
}

function openLessonSheet(key) {
  const content = view.content;
  const lesson = content.lesson(key);
  if (!lesson) return;
  const theme = content.theme(lesson.theme);
  if (!isUnlocked(theme, lesson, content.relecture)) {
    const before = theme.lessons[theme.lessons.indexOf(lesson) - 1];
    showToast(`Termine d’abord la leçon ${before.number}`);
    return;
  }
  const info = lessonInfo(lesson);
  const count = lesson.questions.length;
  let state;
  if (info.complete) state = "Déjà terminée. La refaire rapporte encore des XP.";
  else if (info.fresh) state = `${plural(info.fresh, "nouvelle question", "nouvelles questions")} depuis ta dernière fois.`;
  else state = "Une erreur coûte une vie, et la question revient à la fin. 3 vies par leçon.";
  const sheet = openSheet({
    title: lesson.title || `Leçon ${lesson.number}`,
    body: `<p class="sheet-text">${esc(lesson.title ? `Leçon ${lesson.number} · ${theme.title}` : theme.title)}</p>
      <div class="rv-sheet-facts">
        <span>${icon("layers", "icon--s")}${plural(count, "question", "questions")}</span>
        <span>${icon("clock", "icon--s")}environ ${minutesFor(count)} min</span>
        ${info.complete && info.score ? `<span>${icon("award", "icon--s")}${info.score} % du premier coup</span>` : ""}
        ${content.relecture && lesson.draftCount ? `<span>${icon("clipboard", "icon--s")}${checkedCount(lesson.questions)}/${lesson.draftCount} relues</span>` : ""}
      </div>
      <p class="sheet-text">${state}</p>
      <div class="sheet__actions">
        <button type="button" class="btn btn--primary btn--block btn--big" data-go>${icon(info.complete ? "repeat" : "reviser")}${info.complete ? "Refaire la leçon" : "Commencer la leçon"}</button>
      </div>`,
  });
  sheet.body.addEventListener("click", (event) => {
    if (event.target.closest("[data-go]")) sheet.close().then(() => startLesson(lesson));
  });
}

function openHowSheet() {
  const rows = [
    ["reviser", "Des leçons courtes", "8 à 10 questions par leçon. Après chaque réponse, tu sais tout de suite si c’est juste, avec une explication."],
    ["heart", "3 vies par leçon", "Une erreur coûte une vie, et la question revient à la fin. Plus de vies : la leçon recommence."],
    ["flame", "La série", "Le nombre de jours de suite où tu as fini au moins une leçon ou une révision."],
    ["sun", "Les XP", `${XP.firstTry} par bonne réponse du premier coup, ${XP.corrected} si tu la corriges, ${XP.perfect} de bonus sans faute, ${XP.review} en révision.`],
    ["repeat", "Mes erreurs", "Une question ratée revient le jour même, puis le lendemain, 3 jours et 7 jours plus tard, jusqu’à ce qu’elle soit acquise."],
    ["sparkles", "Réponses à taper", "Les majuscules et les accents ne comptent pas, et une faute de frappe est pardonnée dans les mots de 8 lettres ou plus."],
    ["check", "Des questions vérifiées", "Chaque question est relue avec les cours avant d’apparaître. Un doute ? Vérifie dans tes cours."],
    ["lock", "Sur ce téléphone", "Ta progression reste sur ce téléphone. Les comptes, pour la retrouver ailleurs, arriveront plus tard."],
  ];
  openSheet({
    title: "Comment ça marche",
    body: `<div class="list how-list">${rows.map(([name, title, text]) => `
        <div class="list__row"><span class="list__icon">${icon(name)}</span>
          <div class="list__body"><p class="list__title">${esc(title)}</p><p class="list__text">${esc(text)}</p></div></div>`).join("")}
      </div>
      <p class="footer">Les questions viennent des cours de la formation. En cas de doute, vérifie dans tes cours.</p>`,
  });
}
