/* =====================================================================================
   content.js (Cours): turns content/parcours.json, content/documents.json and (Phase 5)
   content/lecons/index.json into what the Cours tab shows: the whole programme as a path
   of chapters, in the order of the year, each with its bloc de compétences, its lessons,
   its Réviser theme (optional) and its documents.

   A chapter or a document that is broken (a missing title, a link that is not https...)
   is skipped, so one mistake in a file never breaks the app; scripts/check_content.py
   finds the same problems.
   ===================================================================================== */

import { THEME_TONES } from "../reviser/content.js";
import { cleanLessons } from "./lecons.js";

/** What the small coloured square of a document says, and its colour. */
export const KINDS = {
  pdf: { label: "PDF", tone: "bougainvillier" },
  diapo: { label: "DIAPO", tone: "soleil" },
  tableur: { label: "XLS", tone: "olivier" },
  doc: { label: "DOC", tone: "azur" },
  video: { label: "VIDÉO", tone: "lavande" },
  lien: { label: "LIEN", tone: "galet" },
};

const NEW_DAYS = 7;          // a document or a lesson is « Nouveau » for 7 days after it was added
const isText = (value) => typeof value === "string" && value.trim() !== "";
const isHttps = (value) => isText(value) && /^https:\/\/\S+$/.test(value.trim());

/**
 * @param parcours   content of content/parcours.json (or null)
 * @param documents  content of content/documents.json (or null)
 * @param reviser    the content of Réviser (js/reviser/content.js), for the colours
 * @param lecons     content of content/lecons/index.json (or null)
 * Returns {
 *   blocs       every bloc of parcours.json, even without chapters: [{ id, short, title }]
 *   chapters    in the order of the year: [{ id, n, title, when, resume, bloc, theme, tone,
 *               documents, lessons }]
 *               n: its number in the path; bloc: { id, short, title }; theme: a Réviser
 *               theme id or ""; tone: its colour; lessons: in the order of index.json,
 *               each with n (1, 2, 3 in the chapter) and chapter
 *   chapter(id), chapterOfTheme(themeId)
 *   lessons     every lesson, in the order of the path; lesson(id)
 *   documents   every valid document; general: the ones of "chapitre": "general"
 *   folder      the address of the class's Drive folder, or ""
 * }
 */
export function createCours(parcours, documents, reviser, lecons = null) {
  const blocList = (parcours && Array.isArray(parcours.blocs) ? parcours.blocs : [])
    .filter((b) => b && isText(b.id) && isText(b.short));
  const blocById = new Map(blocList.map((b) => [b.id, { id: b.id, short: b.short.trim(), title: isText(b.title) ? b.title.trim() : b.short.trim() }]));

  const docs = (documents && Array.isArray(documents.documents) ? documents.documents : [])
    .filter((d) => d && isText(d.id) && isText(d.title) && isText(d.chapitre) && isHttps(d.url))
    .map((d) => ({
      id: d.id,
      chapitre: d.chapitre,
      title: d.title.trim(),
      kind: KINDS[d.kind] ? d.kind : "lien",
      url: d.url.trim(),
      added: isText(d.added) ? d.added : "",
      note: isText(d.note) ? d.note.trim() : "",
    }));

  // The colour of a chapter is the colour of its theme in Réviser; without a theme, the
  // next colour of the same list.
  let lastTone = -1;
  const seen = new Set();
  const chapters = [];
  for (const c of parcours && Array.isArray(parcours.chapitres) ? parcours.chapitres : []) {
    if (!c || !isText(c.id) || !isText(c.title) || seen.has(c.id) || !blocById.has(c.bloc)) continue;
    seen.add(c.id);
    const theme = isText(c.theme) && reviser ? reviser.theme(c.theme) : null;
    const toneIndex = theme ? THEME_TONES.indexOf(theme.tone) : (lastTone + 1) % THEME_TONES.length;
    lastTone = toneIndex;
    chapters.push({
      id: c.id,
      n: chapters.length + 1,
      title: c.title.trim(),
      when: isText(c.when) ? c.when.trim() : "",
      resume: isText(c.resume) ? c.resume.trim() : "",
      bloc: blocById.get(c.bloc),
      theme: theme ? theme.id : "",
      tone: THEME_TONES[toneIndex] || THEME_TONES[0],
      documents: docs.filter((d) => d.chapitre === c.id),
      lessons: [],
    });
  }

  // The lessons, each in its chapter (in the order of index.json inside the chapter).
  for (const lesson of cleanLessons(lecons, seen)) {
    const chapter = chapters.find((c) => c.id === lesson.chapitre);
    chapter.lessons.push({ ...lesson, n: chapter.lessons.length + 1, chapter });
  }
  const lessons = chapters.flatMap((c) => c.lessons);

  const shown = docs.filter((d) => d.chapitre === "general" || seen.has(d.chapitre));
  return {
    blocs: [...blocById.values()],
    chapters,
    chapter: (id) => chapters.find((c) => c.id === id) || null,
    chapterOfTheme: (themeId) => chapters.find((c) => c.theme && c.theme === themeId) || null,
    lessons,
    lesson: (id) => lessons.find((l) => l.id === id) || null,
    documents: shown,
    general: shown.filter((d) => d.chapitre === "general"),
    folder: documents && isHttps(documents.folder) ? documents.folder.trim() : "",
  };
}

/** Was the document (or the lesson) added less than 7 days ago? */
export function isNew(item, todayIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.added) || item.added > todayIso) return false;
  const days = (Date.parse(todayIso) - Date.parse(item.added)) / 86400000;
  return days < NEW_DAYS;
}
