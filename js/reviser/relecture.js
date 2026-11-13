/* =====================================================================================
   relecture.js: the « Mode relecture », to check the questions before the class sees them.

   New questions arrive with the status "brouillon" (since 7 Nov 2026 everyone sees them).
   The owner switches on « Mode relecture » in Profil, plays the lessons, and after each
   unchecked question taps « Juste » or « À corriger » (with an optional note). The
   « Rapport de relecture » (js/screens/relecture.js) turns these verdicts into a short text
   to paste into Claude chat, which fixes or validates the questions (see docs/PLAN.md).

   Saved on the phone only:
     "promo-mapst:relecture-mode"  true when the mode is on
     "promo-mapst:relecture"       the verdicts, by question id (and by "lecon:<id>" for
                                   the lessons of Cours, since Phase 5):
                                   { "anat-1-04": { fp, v: "juste" | "corriger", note, date } }
   "fp" is the fingerprint of the question (content.js) or of the lesson (js/cours/
   lecons.js): when Claude chat changes it, the fingerprint changes and the old verdict is
   ignored. A lesson is checked as a whole, on its last card (js/cours/lecon.js).
   ===================================================================================== */

import { load, save, remove } from "../core/storage.js";
import { todayISO, dayNumber, MONTHS_SHORT } from "../core/dates.js";

const MODE_KEY = "relecture-mode";
const VERDICTS_KEY = "relecture";
export const NOTE_MAX = 200;              // a note is one short line

let verdicts = null;

// -------------------------------------------------------------------------------------
// The mode
// -------------------------------------------------------------------------------------
export function isRelectureOn() {
  return load(MODE_KEY, false) === true;
}

/** Switches the mode on or off; app.js hears it and rebuilds Réviser. */
export function setRelectureOn(on) {
  save(MODE_KEY, Boolean(on));
  window.dispatchEvent(new CustomEvent("relecture-change", { detail: { on: Boolean(on) } }));
}

// -------------------------------------------------------------------------------------
// The verdicts
// -------------------------------------------------------------------------------------
function readVerdicts() {
  if (!verdicts) {
    const saved = load(VERDICTS_KEY, {});
    verdicts = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  }
  return verdicts;
}

/** One line, no line breaks, not too long. */
export function cleanNote(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX);
}

/** Where a verdict is saved: the id of a question, "lecon:<id>" for a lesson. */
const keyOf = (q) => q.verdictKey || q.id;

/** The verdict on a question: { v: "juste" | "corriger", note, date }, or null (none yet, or the question changed). */
export function verdictFor(q) {
  const saved = readVerdicts()[keyOf(q)];
  return saved && q.fingerprint && saved.fp === q.fingerprint && (saved.v === "juste" || saved.v === "corriger") ? saved : null;
}

/** Saves a verdict ("juste" or "corriger", with a note), or removes it (verdict null). */
export function setVerdict(q, verdict, note = "") {
  const all = readVerdicts();
  if (verdict === "juste" || verdict === "corriger") {
    all[keyOf(q)] = { fp: q.fingerprint, v: verdict, note: verdict === "corriger" ? cleanNote(note) : "", date: todayISO() };
  } else {
    delete all[keyOf(q)];
  }
  save(VERDICTS_KEY, all);
}

/** « Effacer le rapport »: forgets every verdict. */
export function clearVerdicts() {
  verdicts = {};
  remove(VERDICTS_KEY);
}

/**
 * Where the Relecture stands, for the questions still "brouillon" (in file order):
 *   { total, checked, juste: [q], corriger: [{ q, note }], todo: [q] }
 * With a list of lessons instead (js/cours/lecons.js relectureItem), the same for them.
 */
export function relectureSummary(content, items = content.drafts) {
  const juste = [];
  const corriger = [];
  const todo = [];
  for (const q of items) {
    const verdict = verdictFor(q);
    if (!verdict) todo.push(q);
    else if (verdict.v === "juste") juste.push(q);
    else corriger.push({ q, note: verdict.note || "" });
  }
  return { total: items.length, checked: juste.length + corriger.length, juste, corriger, todo };
}

/**
 * The report to paste into Claude chat, as short plain text:
 *   Relecture Promo MAPST · 7 nov. 2026
 *   À corriger (2) :
 *   - anat-1-04 : la réponse C est aussi juste
 *   - fil-1-07
 *   Juste (18) : anat-1-01, anat-1-02, …
 * and, when at least one lesson of Cours has a verdict (lessons: a relectureItem list):
 *
 *   Leçons
 *   À corriger (1) :
 *   - filieres-les-trois : la carte 3 est trop longue
 *   Juste (0)
 */
export function reportText(content, lessons = [], date = new Date()) {
  const verdictLines = (s) => {
    const lines = [s.corriger.length ? `À corriger (${s.corriger.length}) :` : "À corriger (0)"];
    for (const { q, note } of s.corriger) lines.push(note ? `- ${q.id} : ${note}` : `- ${q.id}`);
    lines.push(s.juste.length ? `Juste (${s.juste.length}) : ${s.juste.map((q) => q.id).join(", ")}` : "Juste (0)");
    return lines;
  };
  const lines = [`Relecture Promo MAPST · ${dayNumber(date)} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`,
    ...verdictLines(relectureSummary(content))];
  const l = relectureSummary(content, lessons);
  if (l.checked) lines.push("", "Leçons", ...verdictLines(l));
  return lines.join("\n");
}
