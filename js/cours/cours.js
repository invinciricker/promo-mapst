/* =====================================================================================
   cours.js: the pages of the Cours tab (docs/design/prototype.html, block 6).

     #cours              the whole programme as a path of chapters, in the order of the
                         year. The chips at the top keep one bloc de compétences (« Tout »,
                         BC1, BC2...). Each chapter shows its lessons (« 2 leçons ») and its
                         quiz (its theme in Réviser); a chapter with neither is washed out,
                         with « Bientôt ». Since Phase 5, a glass card at the top opens the
                         next lesson to read (« Commencer » or « Continuer »).
     #cours/<chapter>    one chapter: its lessons, « Réviser ce chapitre », then its
                         documents (« Bientôt » while there are none)
     #cours/<chapter>?lecon=<id>   a lesson, over its chapter (js/cours/lecon.js)
     #cours/documents    every document, by chapter, with a search field from 8 documents

   The documents themselves stay on the class's Google Drive: a tap opens the link in the
   browser. What exists is written in content/parcours.json, content/documents.json and
   content/lecons/index.json (read by js/cours/content.js and js/cours/lecons.js).
   ===================================================================================== */

import { esc, icon, setHTML, plain } from "../core/dom.js";
import { todayISO } from "../core/dates.js";
import { push, switchTab, navbarHTML } from "../core/nav.js";
import { data } from "../core/data.js";
import { themeProgress } from "../reviser/progress.js";
import { isRelectureOn } from "../reviser/relecture.js";
import { KINDS, isNew } from "./content.js";
import { isRead, isStarted, nextLesson } from "./lecons.js";
import { startLecon } from "./lecon.js";

const SEARCH_FROM = 8;       // the search field appears from this many documents
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

/** One document as a row: the kind in a small coloured square, the title, the note. */
function docRowHTML(doc, today) {
  const kind = KINDS[doc.kind];
  return `<a class="row tap doc" href="${esc(doc.url)}" target="_blank" rel="noopener" data-doc="${esc(doc.id)}">
      <span class="doc-kind tone-${kind.tone}">${kind.label}</span>
      <span class="row__main"><span class="row__title">${esc(doc.title)}${isNew(doc, today) ? ` <span class="tag tone-turquoise">Nouveau</span>` : ""}</span>
        ${doc.note ? `<span class="row__sub">${esc(doc.note)}</span>` : ""}</span>
      ${icon("right", "chev")}
    </a>`;
}

/** Opens the theme of a chapter in Réviser. */
const openQuiz = (themeId) => switchTab("reviser", { push: `reviser/${themeId}` });

// -------------------------------------------------------------------------------------
// The path
// -------------------------------------------------------------------------------------
export function mountCours(el) {
  let filter = "";           // a bloc id, or "" for « Tout »

  /** « Quiz 7/10 »: questions answered right in the theme, over its total. */
  function quizLabel(themeId) {
    const theme = data.reviser && data.reviser.theme(themeId);
    if (!theme) return "Quiz";
    const p = themeProgress(theme);
    return p.answered && p.questions ? `Quiz ${p.answered}/${p.questions}` : "Quiz";
  }

  /** « 2 leçons », filled with a check when they are all read. */
  function lessonsPill(c) {
    if (!c.lessons.length) return "";
    const allRead = c.lessons.every((l) => isRead(l.id));
    return `<span class="pill${allRead ? " pill--done" : ""}">${icon(allRead ? "check" : "book", "icon--xs")}${plural(c.lessons.length, "leçon", "leçons")}</span>`;
  }

  function pathHTML() {
    const cours = data.cours;
    const list = cours.chapters.filter((c) => !filter || c.bloc.id === filter);
    const chapters = list.map((c, i) => {
      const empty = !c.lessons.length && !c.theme;      // nothing yet: washed out, « Bientôt »
      return `
        <div class="chap tone-${c.tone}${empty ? " is-empty" : ""}${i < 6 ? " rise" : ""}" style="--i:${i}">
          <span class="chap__n" aria-hidden="true">${c.n}</span>
          <div class="chap__card tap" role="link" tabindex="0" data-chapter="${esc(c.id)}">
            <div class="chap__when">${esc([c.when, c.bloc.short].filter(Boolean).join(" · "))}</div>
            <div class="chap__title">${esc(c.title)}</div>
            ${c.resume ? `<div class="small muted">${esc(c.resume)}</div>` : ""}
            <div class="chap__acts">
              ${lessonsPill(c)}
              ${c.theme ? `<button type="button" class="pill tap" data-quiz="${esc(c.theme)}">${icon("bolt", "icon--xs")}${esc(quizLabel(c.theme))}</button>` : ""}
              ${empty ? `<span class="pill pill--soon">Bientôt</span>` : ""}
            </div>
          </div>
        </div>`;
    }).join("");
    const more = [
      cours.documents.length ? `<button type="button" class="row tap tone-lavande" data-all-docs>
          <span class="tile-icon">${icon("book", "icon--s")}</span>
          <span class="row__main"><span class="row__title">Tous les documents</span>
            <span class="row__sub">${plural(cours.documents.length, "document", "documents")}, par chapitre</span></span>
          ${icon("right", "chev")}</button>` : "",
      cours.folder ? `<a class="row tap tone-azur" href="${esc(cours.folder)}" target="_blank" rel="noopener" data-folder>
          <span class="tile-icon">${icon("folder", "icon--s")}</span>
          <span class="row__main"><span class="row__title">Ouvrir le dossier Drive</span>
            <span class="row__sub">Le dossier partagé de la promo</span></span>
          ${icon("right", "chev")}</a>` : "",
    ].join("");
    const none = cours.chapters.length ? "Rien dans ce bloc pour l’instant" : "Le programme arrive bientôt";
    return `${chapters ? `<div class="path path--chap">${chapters}</div>`
      : `<div class="card empty">${icon("clock")}<b>${none}</b><p>Les chapitres s’ajoutent au fil des cours.</p></div>`}
      ${more ? `<div class="list cours-more">${more}</div>` : ""}`;
  }

  function draw() {
    const cours = data.cours;
    if (!cours) {
      setHTML(el, `<div class="topbar">Cours</div>
        <header class="hd"><div class="hd__row"><h1 class="hd__title">Cours</h1></div></header>
        <div class="body"><div class="card empty">${icon("alert")}<b>Le programme n’a pas pu se charger.</b><p>Vérifie ta connexion internet, puis réessaie.</p></div></div>`);
      return;
    }
    if (filter && !cours.blocs.some((b) => b.id === filter)) filter = "";
    const chip = (id, label) => `<button type="button" class="filters__chip tap" role="radio" aria-checked="${filter === id}" data-bloc="${esc(id)}">${esc(label)}</button>`;
    // The glass card: the next lesson to read, in the order of the path.
    const next = nextLesson(cours);
    const card = next ? `<button type="button" class="gcard tap" data-lecon="${esc(next.id)}">
          <span class="gcard__icon" aria-hidden="true">${icon("book")}</span>
          <div class="row__main"><div class="gcard__title">${esc(next.title)}</div>
          <div class="gcard__sub">${isStarted(next.id) ? "Continuer" : "Commencer"} · ${next.minutes} min</div></div>
          <span class="play" aria-hidden="true">${icon("play")}</span>
        </button>` : "";
    setHTML(el, `
      <div class="topbar">Cours</div>
      <header class="hd">
        <div class="hd__row"><h1 class="hd__title">Cours</h1></div>
        <p class="hd__sub">Le programme dans l’ordre de l’année. Chaque étape a ses leçons et son quiz.</p>
        ${card}
        ${cours.blocs.length ? `<div class="filters" role="radiogroup" aria-label="Bloc de compétences">${chip("", "Tout")}${cours.blocs.map((b) => chip(b.id, b.short)).join("")}</div>` : ""}
      </header>
      <div class="body">${pathHTML()}</div>`);
  }

  el.addEventListener("click", (event) => {
    const t = event.target;
    const bloc = t.closest("[data-bloc]");
    const quiz = t.closest("[data-quiz]");
    const chapter = t.closest("[data-chapter]");
    const lecon = t.closest("[data-lecon]");
    if (lecon) startLecon(data.cours.lesson(lecon.dataset.lecon));
    else if (bloc) {
      if (bloc.dataset.bloc === filter) return;
      filter = bloc.dataset.bloc;
      // A filter hides the other chapters; the numbers stay those of the full path.
      el.querySelectorAll("[data-bloc]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.bloc === filter)));
      setHTML(el.querySelector(".body"), pathHTML());
    } else if (quiz) openQuiz(quiz.dataset.quiz);
    else if (t.closest("[data-all-docs]")) push("cours/documents");
    else if (chapter) push(`cours/${chapter.dataset.chapter}`);
  });
  el.addEventListener("keydown", (event) => {
    const card = event.target.closest && event.target.closest(".chap__card");
    if (card && event.target === card && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); card.click(); }
  });

  draw();
  return { title: "Cours", refresh: draw, onShow: draw };
}

// -------------------------------------------------------------------------------------
// One chapter
// -------------------------------------------------------------------------------------
export function mountChapter(el, chapterId) {
  if (!data.cours || !data.cours.chapter(chapterId)) return null;

  function draw() {
    const c = data.cours.chapter(chapterId);
    if (!c) {
      setHTML(el, `${navbarHTML("Cours")}<div class="page__body">
          <div class="card empty">${icon("clock")}<b>Ce chapitre n’existe plus</b></div></div>`);
      return;
    }
    const today = todayISO();
    const relecture = isRelectureOn();
    // « Leçons »: number, title, « 5 min », a check when read, « Nouveau » for 7 days.
    const lessonRows = c.lessons.map((l) => {
      const read = isRead(l.id);
      return `<button type="button" class="row tap lesson-row${read ? " is-read" : ""}" data-lecon="${esc(l.id)}">
          <span class="lesson-row__n" aria-hidden="true">${l.n}</span>
          <span class="row__main"><span class="row__title">${esc(l.title)}${isNew(l, today) ? ` <span class="tag tone-turquoise">Nouveau</span>` : ""}${relecture && l.draft ? ` <span class="tag tone-citron">À vérifier</span>` : ""}</span>
            <span class="row__sub">${l.minutes} min</span></span>
          ${read ? `<span class="lesson-row__check" aria-label="Lue">${icon("check", "icon--xs")}</span>` : icon("right", "chev")}
        </button>`;
    }).join("");
    setHTML(el, `
      ${navbarHTML("Cours", c.title)}
      <div class="page__body chapter tone-${c.tone}">
        <div class="chapter__head">
          <span class="chap__n" aria-hidden="true">${c.n}</span>
          <div><h1 class="page-title">${esc(c.title)}</h1>
          <p class="chapter__when">${esc([c.when, c.bloc.title].filter(Boolean).join(" · "))}</p></div>
        </div>
        ${c.resume ? `<p class="chapter__resume">${esc(c.resume)}</p>` : ""}
        <h2 class="section-title">Leçons</h2>
        ${c.lessons.length ? `<div class="list">${lessonRows}</div>`
          : `<div class="list"><div class="row lesson-row is-soon"><span class="lesson-row__n" aria-hidden="true">${icon("clock", "icon--xs")}</span>
              <span class="row__main row__title">Les leçons de ce chapitre arrivent.</span></div></div>`}
        ${c.theme ? `<button type="button" class="btn btn--primary btn--block chapter__quiz" data-quiz="${esc(c.theme)}">${icon("bolt", "icon--fill")}Réviser ce chapitre</button>` : ""}
        <h2 class="section-title">Documents</h2>
        ${c.documents.length
          ? `<div class="list">${c.documents.map((d) => docRowHTML(d, today)).join("")}</div>`
          : `<div class="list"><div class="row docs-locked" aria-disabled="true">
              <span class="tile-icon">${icon("lock", "icon--s")}</span>
              <span class="row__main row__title">Documents du cours</span>
              <span class="tag">Bientôt</span></div></div>`}
      </div>`);
  }

  el.addEventListener("click", (event) => {
    const quiz = event.target.closest("[data-quiz]");
    const lecon = event.target.closest("[data-lecon]");
    if (quiz) openQuiz(quiz.dataset.quiz);
    else if (lecon) startLecon(data.cours.lesson(lecon.dataset.lecon));
  });

  draw();
  return { title: data.cours.chapter(chapterId).title, refresh: draw };
}

// -------------------------------------------------------------------------------------
// Every document
// -------------------------------------------------------------------------------------
export function mountAllDocuments(el) {
  if (!data.cours) return null;
  let query = "";

  /** The documents grouped by chapter (in the order of the path), then « Général ». */
  function groupsHTML() {
    const cours = data.cours;
    const today = todayISO();
    const wanted = plain(query);
    const match = (d) => !wanted || plain(`${d.title} ${d.note}`).includes(wanted);
    const groups = cours.chapters.map((c) => [c.title, c.documents.filter(match)])
      .concat([["Général", cours.general.filter(match)]])
      .filter(([, list]) => list.length);
    if (!groups.length) {
      return `<div class="card empty">${icon("search")}<p>${cours.documents.length ? "Aucun document ne correspond." : "Aucun document pour l’instant."}</p></div>`;
    }
    return groups.map(([title, list]) => `<h2 class="group-title">${esc(title)}</h2>
        <div class="list">${list.map((d) => docRowHTML(d, today)).join("")}</div>`).join("");
  }

  function draw() {
    const cours = data.cours;
    const withSearch = cours.documents.length >= SEARCH_FROM;
    if (!withSearch) query = "";
    setHTML(el, `
      ${navbarHTML("Cours", "Tous les documents")}
      <div class="page__body">
        <h1 class="page-title">Tous les documents</h1>
        <p class="muted docs__lead">${plural(cours.documents.length, "document", "documents")}. Ils s’ouvrent sur le Drive de la promo.</p>
        ${withSearch ? `<label class="docs__search">${icon("search", "icon--s")}
          <input class="input" type="search" name="q" value="${esc(query)}" placeholder="Chercher un document" aria-label="Chercher un document" autocomplete="off" enterkeyhint="search"></label>` : ""}
        <div class="docs__groups">${groupsHTML()}</div>
        ${cours.folder ? `<div class="list cours-more"><a class="row tap tone-azur" href="${esc(cours.folder)}" target="_blank" rel="noopener" data-folder>
          <span class="tile-icon">${icon("folder", "icon--s")}</span>
          <span class="row__main row__title">Ouvrir le dossier Drive</span>${icon("right", "chev")}</a></div>` : ""}
      </div>`);
  }

  el.addEventListener("input", (event) => {
    if (!event.target.matches(".docs__search input")) return;
    query = event.target.value;
    setHTML(el.querySelector(".docs__groups"), groupsHTML());
  });

  draw();
  return { title: "Tous les documents", refresh: draw };
}
