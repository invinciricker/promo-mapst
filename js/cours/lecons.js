/* =====================================================================================
   lecons.js: the lessons of Cours (Phase 5), short decks of cards written by Claude chat.

     content/lecons/index.json   the list, in order inside each chapter (cleanLessons)
     content/lecons/<id>.md      the text of each lesson (loadLesson, read by markdown.js)
     content/lecons/img/         their pictures

   Adding a lesson never needs code: docs/AJOUTER-UNE-LECON.md. A broken entry of the
   index (no title, an unknown chapter...) is skipped, so one mistake never breaks the app;
   scripts/check_content.py finds the same problems.

   Saved on the phone only ("promo-mapst:lecons"), by lesson id:
     { "filieres-les-trois": { "at": 3, "read": "2026-11-13" } }
     at    the card where the lesson was left (0 = the first): reopening resumes there
     read  the day the last card was reached (the lesson is « lue »)
   ===================================================================================== */

import { load, save } from "../core/storage.js";
import { todayISO } from "../core/dates.js";
import { parseLesson } from "./markdown.js";

export const LESSON_STATUSES = ["brouillon", "verifie"];
const KEY = "lecons";

const isText = (value) => typeof value === "string" && value.trim() !== "";
const isMap = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * The lessons of content/lecons/index.json that can be shown, in the order of the file.
 *   chapterIds  the ids of the chapters of the path (a lesson of another chapter is skipped)
 * Each: { id, chapitre, title, minutes, source, status, draft, added }
 */
export function cleanLessons(index, chapterIds) {
  const seen = new Set();
  const list = [];
  for (const l of index && Array.isArray(index.lecons) ? index.lecons : []) {
    if (!l || !isText(l.id) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(l.id.trim()) || !isText(l.title)) continue;
    const id = l.id.trim();
    if (seen.has(id) || !chapterIds.has(l.chapitre)) continue;
    seen.add(id);
    const status = LESSON_STATUSES.includes(l.status) ? l.status : "brouillon";
    const minutes = Number(l.minutes);
    list.push({
      id,
      chapitre: l.chapitre,
      title: l.title.trim(),
      minutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 5,
      source: isText(l.source) ? l.source.trim() : "",
      status,
      draft: status === "brouillon",       // not checked yet: « À vérifier » in Relecture
      added: isText(l.added) ? l.added.trim() : "",
    });
  }
  return list;
}

// -------------------------------------------------------------------------------------
// The texts (fetched when needed, and in the background so they also work offline)
// -------------------------------------------------------------------------------------
const texts = new Map();      // id -> { text, cards, fingerprint }

/** 8 letters and digits that change as soon as the lesson changes (for the Relecture). */
function fingerprintOf(title, text) {
  const value = `${title}\u0000${text}`;
  let hash = 0x811c9dc5;                         // FNV-1a, like the questions (reviser/content.js)
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Fetches and reads the text of a lesson: { text, cards, fingerprint }. */
export async function loadLesson(lesson) {
  // "no-cache": always ask GitHub Pages if the file changed (sw.js keeps a copy for offline).
  const response = await fetch(`content/lecons/${lesson.id}.md`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`content/lecons/${lesson.id}.md: ${response.status}`);
  const text = await response.text();
  const known = texts.get(lesson.id);
  if (known && known.text === text && known.title === lesson.title) return known;
  const entry = { text, title: lesson.title, cards: parseLesson(text), fingerprint: fingerprintOf(lesson.title, text) };
  texts.set(lesson.id, entry);
  return entry;
}

/** The text of a lesson if it is already loaded, else null. */
export const loadedLesson = (id) => texts.get(id) || null;

/**
 * Fetches every lesson and its pictures in the background, so that they are saved on the
 * phone (sw.js) and work offline even before they are opened. Returns when all are done.
 */
export async function prefetchLessons(lessons) {
  for (const lesson of lessons) {
    try {
      const { cards } = await loadLesson(lesson);
      const pictures = cards.flatMap((card) => card.blocks.filter((b) => b.type === "img").map((b) => b.src));
      await Promise.all(pictures.map((src) => fetch(`content/lecons/${src}`).catch(() => null)));
    } catch (error) {
      /* offline, or a missing file (scripts/check_content.py reports it) */
    }
  }
}

// -------------------------------------------------------------------------------------
// What is saved on the phone: the lessons read, the card where one was left
// -------------------------------------------------------------------------------------
function readAll() {
  const saved = load(KEY, {});
  return isMap(saved) ? saved : {};
}

/** { at, read }: the card where the lesson was left (0 = first), and whether it was read. */
export function lessonProgress(id) {
  const saved = readAll()[id];
  return {
    at: isMap(saved) && Number.isInteger(saved.at) && saved.at > 0 ? saved.at : 0,
    read: isMap(saved) && isText(saved.read),
  };
}

/** Remembers the card on screen, so the lesson resumes there. */
export function saveAt(id, at) {
  const all = readAll();
  const before = isMap(all[id]) ? all[id] : {};
  all[id] = { ...before, at: Math.max(0, Math.round(at)) };
  save(KEY, all);
}

/** The last card was reached: the lesson is read, and it starts from the top next time. */
export function markRead(id) {
  const all = readAll();
  all[id] = { at: 0, read: todayISO() };
  save(KEY, all);
}

export const isRead = (id) => lessonProgress(id).read;

/** Started and not finished: « Continuer ». */
export function isStarted(id) {
  const p = lessonProgress(id);
  return !p.read && p.at > 0;
}

/** The next lesson to read, in the order of the path (null when all are read). */
export function nextLesson(cours) {
  return (cours && cours.lessons.find((l) => !isRead(l.id))) || null;
}

/**
 * A lesson as the Relecture sees it (js/reviser/relecture.js): like a question, with an
 * id, a fingerprint and a text. Its verdict is saved under "lecon:<id>", so it never
 * mixes with a question that has the same id. fingerprint is null until the text is loaded.
 */
export function relectureItem(lesson) {
  const loaded = texts.get(lesson.id);
  return {
    id: lesson.id,
    verdictKey: `lecon:${lesson.id}`,
    fingerprint: loaded ? loaded.fingerprint : null,
    text: lesson.title,
    draft: lesson.draft,
    lesson,
  };
}
