/* =====================================================================================
   verdict.js: the « Juste / À corriger » buttons of the Relecture, and the sheet that
   asks for the note. Used after the feedback of an unchecked question (player.js) and
   in the « Rapport de relecture » (js/screens/relecture.js).
   What is saved, and how, is in relecture.js.
   ===================================================================================== */

import { esc, icon } from "../core/dom.js";
import { openSheet } from "../core/sheet.js";
import { verdictFor, setVerdict, NOTE_MAX } from "./relecture.js";

/** A question cut to its first words, for small reminders. */
export function shortText(text, max = 90) {
  const t = String(text || "");
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** The box with the two buttons (and the note, if any). */
export function verdictHTML(q) {
  const v = verdictFor(q);
  const pressed = (name) => String(Boolean(v && v.v === name));
  return `<div class="verdict" data-verdict-box role="group" aria-label="Relecture de la question ${esc(q.id)}">
      <p class="verdict__label">${icon("clipboard", "icon--s")}<span>Relecture : cette question est-elle juste ?</span></p>
      <div class="verdict__btns">
        <button type="button" class="verdict__btn verdict__btn--ok" data-verdict="juste" aria-pressed="${pressed("juste")}">${icon("check")}Juste</button>
        <button type="button" class="verdict__btn verdict__btn--fix" data-verdict="corriger" aria-pressed="${pressed("corriger")}">${icon("edit")}À corriger</button>
      </div>
      ${v && v.v === "corriger" ? `<p class="verdict__note">${v.note ? `Ta note : « ${esc(v.note)} »` : "Sans note."}
        <button type="button" class="verdict__edit" data-verdict="corriger">Modifier</button></p>` : ""}
    </div>`;
}

/**
 * Handles a tap inside a verdict box. Returns true if the tap was for it.
 *   « Juste »       saves "juste" (a second tap removes it)
 *   « À corriger »  opens the sheet for the note; saved with « Enregistrer »
 *   onChange()      called after each change, to redraw the box
 */
export function handleVerdictTap(event, q, onChange) {
  const button = event.target.closest("[data-verdict]");
  if (!button) return false;
  if (button.dataset.verdict === "juste") {
    const current = verdictFor(q);
    setVerdict(q, current && current.v === "juste" ? null : "juste");
    onChange();
  } else {
    openNoteSheet(q, onChange);
  }
  return true;
}

/** The sheet « À corriger »: an optional one-line note, then « Enregistrer ». */
export function openNoteSheet(q, onChange = () => {}) {
  const v = verdictFor(q);
  const sheet = openSheet({
    title: "À corriger",
    body: `<p class="sheet-text"><span class="badge">${esc(q.id)}</span> ${esc(shortText(q.text, 140))}</p>
      <label class="field">
        <span class="field__label">Ce qui ne va pas (facultatif)</span>
        <input class="input" type="text" data-note maxlength="${NOTE_MAX}" autocomplete="off" enterkeyhint="done"
          placeholder="Ex. : la réponse C est aussi juste" value="${esc(v && v.v === "corriger" ? v.note : "")}">
      </label>
      <p class="sheet-hint">Une ligne suffit. Elle sera dans le rapport à coller dans Claude chat.</p>
      <div class="sheet__actions">
        <button type="button" class="btn btn--primary btn--block" data-save>${icon("edit")}Enregistrer « À corriger »</button>
        ${v ? `<button type="button" class="btn btn--plain btn--block" data-clear>Retirer mon avis</button>` : ""}
      </div>`,
  });
  const input = sheet.body.querySelector("[data-note]");
  const saveNote = () => {
    setVerdict(q, "corriger", input.value);
    sheet.close().then(onChange);
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); saveNote(); }
  });
  sheet.body.addEventListener("click", (event) => {
    if (event.target.closest("[data-save]")) saveNote();
    else if (event.target.closest("[data-clear]")) {
      setVerdict(q, null);
      sheet.close().then(onChange);
    }
  });
  // On a laptop the cursor goes straight into the field (on a phone, the keyboard would
  // hide the button: the person taps the field when they want to write).
  if (window.matchMedia("(pointer: fine)").matches) requestAnimationFrame(() => input.focus({ preventScroll: true }));
  return sheet;
}
