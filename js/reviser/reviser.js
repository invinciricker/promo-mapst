/* =====================================================================================
   reviser.js: the pages of the Réviser tab.

     #reviser            the home of Réviser: série and XP, one card with « Continuer » and
                         « Mes erreurs », then the theme tiles
     #reviser/<theme>    one theme: its lessons on a vertical path (they unlock in order)

   The lesson itself opens over the app (player.js), from here or from Accueil.
   What is remembered (XP, série, questions done, mistakes, lessons left in the middle) is
   in progress.js, the questions in content.js, and the « Mode relecture » in relecture.js.
   ===================================================================================== */

import { esc, icon, ring, setHTML } from "../core/dom.js";
import { push, navbarHTML, registerModal, refreshPages } from "../core/nav.js";
import { openSheet } from "../core/sheet.js";
import { showToast } from "../core/toast.js";
import { FOOTER } from "../core/texts.js";
import { data } from "../core/data.js";
import { openPlayer, isPlaying } from "./player.js";
import { soundOn, setSoundOn } from "./sound.js";
import { verdictFor, relectureSummary } from "./relecture.js";
import { XP, xpTotal, streak, lessonInfo, lessonRing, lessonRun, saveRun, clearRun, isUnlocked,
  themeProgress, currentLesson, nextLesson, mistakes, daysUntil, finishSession } from "./progress.js";

const REVIEW_SIZE = 10;            // questions per « Mes erreurs » session
let justDone = null;               // the lesson just finished: the next one gets a little animation

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

/** « Os et articulations », or « Leçon 2 » when the lesson has no title. */
export const lessonName = (lesson) => lesson.title || `Leçon ${lesson.number}`;

/** « Leçon 1 · Os et articulations », or « Leçon 1 » (at the top of the lesson). */
export function lessonHeading(lesson) {
  return lesson.title ? `Leçon ${lesson.number} · ${lesson.title}` : `Leçon ${lesson.number}`;
}

/** In Relecture: how many unchecked questions of a list already have a verdict. */
function checkedCount(questions) {
  return questions.filter((q) => q.draft && verdictFor(q)).length;
}

// -------------------------------------------------------------------------------------
// Pieces shared with Accueil
// -------------------------------------------------------------------------------------

/** The chips « 🔥 3 jours » and « ⚡ 120 XP » (short: « 3 » for the page head). */
export function statsChips({ short = false, nudge = "" } = {}) {
  const s = streak();
  const days = short ? String(s.count) : `${s.count} ${s.count > 1 ? "jours" : "jour"}`;
  return `${s.count || short ? `<span class="chip tone-soleil" aria-label="${esc(plural(s.count, "jour", "jours"))} de série">${icon("flame", "icon--fill")}${days}</span>` : ""}
    ${nudge ? `<span class="small muted rv-nudge">${esc(nudge)}</span>` : `<span class="chip tone-soleil">${icon("bolt", "icon--fill")}${xpTotal()} XP</span>`}`;
}

/**
 * The lesson « Continuer » proposes, with its ring: { theme, lesson, ring } or null.
 * In Relecture, the first lesson with questions not checked yet comes first.
 */
export function lessonToContinue() {
  const content = data.reviser;
  if (!content) return null;
  const next = nextLesson(content);
  if (!next) return null;
  return { ...next, ring: lessonRing(next.lesson) };
}

/** The address of a lesson: "anatomie-mouvement-1". */
const lessonAddress = (lesson) => `${lesson.theme}-${lesson.number}`;

// -------------------------------------------------------------------------------------
// Home of Réviser
// -------------------------------------------------------------------------------------
export function mountReviserHome(el) {
  const draw = () => {
    const content = data.reviser;
    const next = lessonToContinue();
    const errors = mistakes(content);

    // « Continuer » (or what to say when there is nothing to continue)
    let continueRow;
    if (!content.total) {
      continueRow = `<div class="row">
          <span class="tile-icon tile-icon--m tone-azur">${icon("clock", "icon--s")}</span>
          <div class="row__main"><div class="row__title">Questions en préparation</div>
          <div class="row__sub">Les leçons arrivent bientôt.</div></div></div>`;
    } else if (next) {
      const r = next.ring;
      const sub = r.run ? `Continuer, ${r.answered} sur ${r.total}`
        : r.answered ? `${plural(r.total - r.answered, "nouvelle question", "nouvelles questions")}`
          : `Nouvelle leçon, ${plural(r.total, "question", "questions")}`;
      continueRow = `<button type="button" class="row tone-${next.theme.tone}" data-start="${esc(next.lesson.key)}">
          ${ring(r.total ? r.answered / r.total : 0, { size: 40 })}
          <div class="row__main"><div class="row__title">${esc(lessonName(next.lesson))}</div>
          <div class="row__sub">${esc(sub)}</div></div>
          <span class="play" aria-hidden="true">${icon("play", "icon--s")}</span>
          <span class="visually-hidden">${esc(r.verb)}</span>
        </button>`;
    } else {
      continueRow = `<div class="row">
          <span class="tile-icon tile-icon--m tone-turquoise">${icon("check", "icon--s")}</span>
          <div class="row__main"><div class="row__title">Tout est à jour</div>
          <div class="row__sub">Toutes les leçons sont faites. Refais-en une pour gagner des XP.</div></div></div>`;
    }

    // « Mes erreurs »
    let errorsRow;
    if (errors.due.length) {
      errorsRow = `<div class="row tone-bougainvillier">
          <span class="tile-icon tile-icon--m">${icon("repeat", "icon--s")}</span>
          <div class="row__main"><div class="row__title">Mes erreurs</div>
          <div class="row__sub">${plural(errors.due.length, "question à revoir", "questions à revoir")}</div></div>
          <button type="button" class="btn btn--small btn--soft" data-review>Revoir</button></div>`;
    } else {
      const wait = errors.nextDue ? daysUntil(errors.nextDue) : 1;
      errorsRow = `<div class="row tone-bougainvillier">
          <span class="tile-icon tile-icon--m">${icon("repeat", "icon--s")}</span>
          <div class="row__main"><div class="row__title">Mes erreurs</div>
          <div class="row__sub">${errors.all
            ? `Rien à revoir aujourd’hui. ${plural(errors.all, "question revient", "questions reviennent")} ${wait <= 1 ? "demain" : `dans ${wait} jours`}.`
            : "Aucune erreur pour l’instant. Les questions ratées viendront ici."}</div></div></div>`;
    }

    // The theme tiles
    const tiles = content.themes.map((theme) => {
      const p = themeProgress(theme);
      let foot;
      if (!p.total) foot = `<small>Questions en préparation</small>`;
      else if (p.done === p.total) foot = `<small class="is-done">${icon("check", "icon--xs")}Terminé</small>`;
      else if (p.started) {
        const lesson = currentLesson(theme, content.relecture) || theme.lessons[0];
        foot = `<small>Leçon ${lesson.number} sur ${p.total}</small>`;
      } else foot = `<small>${plural(p.total, "leçon", "leçons")}</small>`;
      const percent = Math.round((p.done === p.total && p.total ? 1 : p.share) * 100);
      return `<button type="button" class="rv-tile tone-${theme.tone}" data-theme="${esc(theme.id)}">
          <span class="tile-icon">${icon(theme.icon, "icon--s")}</span>
          <span class="rv-tile__title">${esc(theme.title)}</span>
          <span class="rv-tile__foot"><span class="bar">${percent ? `<i style="width:${percent}%"></i>` : ""}</span>${foot}</span>
        </button>`;
    }).join("");

    setHTML(el, `
      <div class="page__body">
        <div class="page-head">
          <h1 class="page-title">Réviser</h1>
          <span class="page-head__end">${statsChips({ short: true })}</span>
        </div>
        ${relectureCard(content)}
        ${content.hasExamples ? `<div class="note">${icon("info")}<p><b>Questions d’exemple.</b> Elles portent le badge « Exemple ».</p></div>` : ""}
        <div class="list rv-next">${continueRow}${errorsRow}</div>
        <h2 class="section-title">Thèmes</h2>
        <div class="rv-grid">${tiles}</div>
        <div class="rv-tools">
          <button type="button" class="btn btn--small btn--plain" data-how>${icon("info", "icon--s")}Comment ça marche</button>
          <button type="button" class="btn btn--small btn--plain" data-sound aria-pressed="${soundOn()}">${icon(soundOn() ? "volume" : "mute", "icon--s")}Sons ${soundOn() ? "activés" : "coupés"}</button>
        </div>
        <p class="footer-note">${esc(FOOTER)}</p>
      </div>`);
  };

  el.addEventListener("click", (event) => {
    const t = event.target;
    const theme = t.closest("[data-theme]");
    const start = t.closest("[data-start]");
    if (start) startLesson(data.reviser.lesson(start.dataset.start));
    else if (theme) push(`reviser/${theme.dataset.theme}`);
    else if (t.closest("[data-review]")) startReview();
    else if (t.closest("[data-report]")) push("reviser/relecture");
    else if (t.closest("[data-how]")) openHowSheet();
    else if (t.closest("[data-sound]")) {
      setSoundOn(!soundOn());
      showToast(soundOn() ? "Sons et vibrations activés" : "Sons et vibrations coupés");
      draw();
    }
  });

  draw();
  return { title: "Réviser", refresh: draw, onShow: draw };
}

/** In « Mode relecture »: where the checking stands, and the way to the report. */
function relectureCard(content) {
  if (!content.relecture) return "";
  const s = relectureSummary(content);
  const share = s.total ? s.checked / s.total : 0;
  return `<button type="button" class="card rv-relecture tone-lavande" data-report>
      <span class="tile-icon tile-icon--m">${icon("eye", "icon--s")}</span>
      <span class="row__main">
        <span class="row__title">Mode relecture</span>
        <span class="row__sub">${s.total
          ? `${s.checked} sur ${s.total} relues${s.corriger.length ? ` · ${s.corriger.length} à corriger` : ""}`
          : "Aucune question à vérifier pour l’instant"}</span>
        ${s.total ? `<span class="bar"><i style="width:${Math.round(share * 100)}%"></i></span>` : ""}
      </span>
      <span class="rv-relecture__end">Rapport${icon("right", "icon--s")}</span>
    </button>`;
}

// -------------------------------------------------------------------------------------
// One theme: the path of its lessons
// -------------------------------------------------------------------------------------
export function mountTheme(el, themeId) {
  if (!data.reviser || !data.reviser.theme(themeId)) return null;

  const draw = () => {
    const content = data.reviser;
    const theme = content.theme(themeId);
    if (!theme) {
      setHTML(el, `<div class="page__body">${navbarHTML("Réviser")}
          <div class="card empty">${icon("clock")}<b>Ce thème n’existe plus</b></div></div>`);
      return;
    }
    const relecture = content.relecture;
    const current = currentLesson(theme, relecture);
    const done = theme.lessons.filter((l) => lessonInfo(l).complete);
    const freshKey = justDone && current && done.some((l) => l.key === justDone) ? current.key : null;

    const steps = theme.lessons.map((lesson, i) => {
      const info = lessonInfo(lesson);
      const r = lessonRing(lesson);
      const unlocked = isUnlocked(theme, lesson, relecture);
      const state = info.complete ? "done" : lesson === current ? "now" : unlocked ? "open" : "locked";
      const previous = theme.lessons[i - 1];
      const relu = relecture && lesson.draftCount
        ? ` <span class="tag ${checkedCount(lesson.questions) === lesson.draftCount ? "tone-turquoise" : "tone-lavande"}">${checkedCount(lesson.questions)}/${lesson.draftCount} relues</span>`
        : "";
      let node;
      let detail;
      let button = "";
      if (state === "done") {
        node = `<button type="button" class="node node--done" data-start="${esc(lesson.key)}" aria-label="${esc(`Refaire la leçon ${lesson.number}`)}">${icon("check")}</button>`;
        detail = `Terminée${info.score ? ` · ${info.score} % du premier coup` : ""}`;
        button = `<button type="button" class="btn btn--small btn--soft lesson__btn" data-start="${esc(lesson.key)}">${icon("repeat")}Refaire</button>`;
      } else if (state === "now" || state === "open") {
        node = `<button type="button" class="node node--${state}" data-start="${esc(lesson.key)}" aria-label="${esc(`${r.verb} la leçon ${lesson.number}`)}">
            ${state === "now" ? ring(r.total ? r.answered / r.total : 0, { size: 70, track: "var(--c-tint)" }) : ""}${icon("play")}</button>`;
        detail = r.run || r.answered ? `${plural(r.answered, "question", "questions")} sur ${r.total}`
          : plural(r.total, "question", "questions");
        if (info.fresh && !r.run) detail = plural(info.fresh, "nouvelle question", "nouvelles questions");
        button = `<button type="button" class="btn btn--small ${state === "now" ? "btn--tone" : "btn--soft"} lesson__btn" data-start="${esc(lesson.key)}">${esc(r.verb)}</button>`;
      } else {
        node = `<span class="node node--locked">${icon("lock")}</span>`;
        detail = `S’ouvre quand la leçon ${previous ? previous.number : 1} est finie.`;
      }
      return `<li class="lesson is-${state}${lesson.key === freshKey ? " is-new" : ""}">
          ${node}
          <div class="lesson__text">
            <div class="lesson__n">Leçon ${lesson.number}${relu}</div>
            <div class="lesson__title">${esc(lessonName(lesson))}</div>
            <div class="small ${state === "locked" ? "faint" : "muted"}">${esc(detail)}</div>
            ${button}
          </div>
        </li>`;
    }).join("");

    setHTML(el, `
      <div class="page__body">
        ${navbarHTML("Réviser", theme.title)}
        <div class="theme-head tone-${theme.tone}">
          <span class="tile-icon tile-icon--l">${icon(theme.icon)}</span>
          <div><h1 class="page-title theme-head__title">${esc(theme.title)}</h1>
          <div class="small muted">${theme.lessons.length
            ? `${plural(theme.lessons.length, "leçon", "leçons")}, ${plural(theme.questionCount, "question", "questions")}`
            : "Questions en préparation"}</div></div>
        </div>
        ${relectureCard(content)}
        ${theme.lessons.length
          ? `<ol class="path tone-${theme.tone}">${steps}</ol>
             <p class="small faint path__more">D’autres leçons arrivent au fil des cours.</p>`
          : `<div class="card empty rv-soon">${icon("clock")}<b>Questions en préparation</b>
             <p>Les leçons de ce thème arrivent au fil des cours. Reviens bientôt !</p></div>`}
      </div>`);
    const fresh = el.querySelector(".lesson.is-new");
    if (fresh) fresh.scrollIntoView({ block: "center", behavior: "smooth" });
    justDone = null;
  };

  el.addEventListener("click", (event) => {
    const start = event.target.closest("[data-start]");
    if (start) startLesson(data.reviser.lesson(start.dataset.start));
    else if (event.target.closest("[data-report]")) push("reviser/relecture");
    else if (event.target.closest(".node--locked")) {
      const lesson = event.target.closest(".lesson");
      const theme = data.reviser.theme(themeId);
      const index = [...lesson.parentElement.children].indexOf(lesson);
      if (theme && theme.lessons[index - 1]) showToast(`Termine d’abord la leçon ${theme.lessons[index - 1].number}`);
    }
  });

  draw();
  return { title: data.reviser.theme(themeId).title, refresh: draw, onShow: draw };
}

// -------------------------------------------------------------------------------------
// Lessons and « Mes erreurs »
// -------------------------------------------------------------------------------------

/** Opens a lesson (it continues where it was left, if it was). */
export function startLesson(lesson) {
  if (!lesson || isPlaying()) return;
  const content = data.reviser;
  const theme = content.theme(lesson.theme);
  if (!isUnlocked(theme, lesson, content.relecture)) return;
  const run = lessonRun(lesson);
  openPlayer({
    title: theme.title,
    heading: lessonHeading(lesson),
    questions: lesson.questions,
    address: ["lecon", lessonAddress(lesson)],
    relecture: content.relecture,
    run,
    onProgress: (state) => saveRun(lesson, state),
    onLost: () => clearRun(lesson),
    onFinish: (result) => {
      justDone = lesson.key;
      return finishSession({
        kind: "lesson", themeId: theme.id, lessonKey: lesson.key, xp: result.xp,
        questionIds: result.questionIds, firstTryIds: result.firstTryIds,
      });
    },
    onClose: () => refreshPages(),
  });
}

/** Opens « Mes erreurs » (the questions to review today, 10 at most). */
export function startReview() {
  if (isPlaying()) return false;
  const due = mistakes(data.reviser).due.slice(0, REVIEW_SIZE);
  if (!due.length) return false;
  openPlayer({
    title: "Mes erreurs",
    questions: due,
    review: true,
    address: ["revision", ""],
    relecture: data.reviser.relecture,
    onFinish: (result) => finishSession({ kind: "review", xp: result.xp }),
    onClose: () => refreshPages(),
  });
  return true;
}

// The lesson and « Mes erreurs » have their own address: the app can open on them.
registerModal("lecon", (value) => {
  const match = /^(.+)-(\d+)$/.exec(value || "");
  const lesson = match && data.reviser ? data.reviser.lesson(`${match[1]}:${Number(match[2])}`) : null;
  if (!lesson) return false;
  const theme = data.reviser.theme(lesson.theme);
  if (!isUnlocked(theme, lesson, data.reviser.relecture)) return false;
  startLesson(lesson);
  return true;
});
registerModal("revision", () => (data.reviser ? startReview() : false));
registerModal("aide", () => { openHowSheet(); return true; });

function openHowSheet() {
  const rows = [
    ["bolt", "Des leçons courtes", "8 à 10 questions par leçon. Après chaque réponse, tu sais tout de suite si c’est juste, avec une explication."],
    ["heart", "3 vies par leçon", "Une erreur coûte une vie, et la question revient à la fin. Plus de vies : la leçon recommence."],
    ["play", "Tu peux t’arrêter", "Quitte une leçon avec ×, elle t’attend : « Continuer » reprend là où tu en étais."],
    ["flame", "La série", "Le nombre de jours de suite où tu as fini au moins une leçon ou une révision."],
    ["sun", "Les XP", `${XP.firstTry} par bonne réponse du premier coup, ${XP.corrected} si tu la corriges, ${XP.perfect} de bonus sans faute, ${XP.review} en révision.`],
    ["repeat", "Mes erreurs", "Une question ratée revient le jour même, puis le lendemain, 3 jours et 7 jours plus tard, jusqu’à ce qu’elle soit acquise."],
    ["edit", "Réponses à taper", "Les majuscules et les accents ne comptent pas, et une faute de frappe est pardonnée dans les mots de 8 lettres ou plus."],
    ["lock", "Sur ce téléphone", "Ta progression reste sur ce téléphone. Les comptes, pour la retrouver ailleurs, arrivent bientôt."],
  ];
  openSheet({
    title: "Comment ça marche",
    address: "aide",
    body: `<div class="list how-list">${rows.map(([name, title, text]) => `
        <div class="row row--top tone-turquoise"><span class="tile-icon">${icon(name, "icon--s")}</span>
          <div class="row__main"><div class="row__title">${esc(title)}</div><div class="row__sub">${esc(text)}</div></div></div>`).join("")}
      </div>
      <p class="footer-note" style="margin-top:0">Les questions viennent des cours de la formation. En cas de doute, vérifie dans tes cours.</p>`,
  });
}
