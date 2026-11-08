/* =====================================================================================
   event-form.js: the sheet to add or change a personal event (button « + »).
   The event is saved on this phone only (see personal.js).
   ===================================================================================== */

import { icon } from "../core/dom.js";
import { todayISO } from "../core/dates.js";
import { openSheet } from "../core/sheet.js";
import { showToast } from "../core/toast.js";
import { getEvent, saveEvent, deleteEvent } from "./personal.js";

/**
 * openEventForm({ eventId })        changes an existing event
 * openEventForm({ date: "2026-11-17" })  adds a new one on that day
 * Its address is #…?evenement=<id> (or ?evenement=nouveau).
 */
export function openEventForm({ eventId = null, date = null } = {}) {
  const existing = eventId ? getEvent(eventId) : null;
  if (eventId && !existing) return false;          // an event deleted since (old address)

  const body = `
    <form class="ev-form" novalidate>
      <label class="field">
        <span class="field__label">Quoi</span>
        <input class="input" name="ev-title" type="text" maxlength="80" autocomplete="off"
          placeholder="Rendez-vous, sport, révisions…" enterkeyhint="next">
      </label>
      <label class="field">
        <span class="field__label">Date</span>
        <input class="input" name="ev-date" type="date">
      </label>
      <label class="switch-row">
        <span>Toute la journée</span>
        <span class="switch"><input type="checkbox" name="ev-allday" role="switch" aria-label="Toute la journée"><span class="switch__track"></span></span>
      </label>
      <div class="fields-2" data-times>
        <label class="field"><span class="field__label">Début</span><input class="input" name="ev-start" type="time"></label>
        <label class="field"><span class="field__label">Fin (facultatif)</span><input class="input" name="ev-end" type="time"></label>
      </div>
      <label class="field">
        <span class="field__label">Répéter</span>
        <select class="input" name="ev-repeat">
          <option value="none">Jamais</option>
          <option value="weekly">Chaque semaine</option>
          <option value="monthly">Chaque mois</option>
        </select>
      </label>
      <label class="field">
        <span class="field__label">Lieu (facultatif)</span>
        <input class="input" name="ev-place" type="text" maxlength="120" autocomplete="off">
      </label>
      <label class="field">
        <span class="field__label">Note (facultatif)</span>
        <textarea class="input" name="ev-note" maxlength="500"></textarea>
      </label>
      <p class="form-msg" role="alert"></p>
      <div class="sheet__actions">
        <button type="submit" class="btn btn--primary btn--block">Enregistrer</button>
        ${existing ? `<button type="button" class="btn btn--danger btn--block" data-delete>${icon("trash", "icon--s")}<span>Supprimer</span></button>` : ""}
      </div>
      <p class="sheet-hint">Enregistré sur ce téléphone seulement, en couleur Citron.</p>
    </form>`;

  const sheet = openSheet({
    title: existing ? "Modifier l’événement" : "Nouvel événement",
    body,
    className: "cat-perso",
    address: ["evenement", existing ? existing.id : "nouveau"],
  });
  const form = sheet.body.querySelector("form");
  const field = (name) => form.elements.namedItem(name);
  const message = form.querySelector(".form-msg");

  // Fill the form
  field("ev-title").value = existing ? existing.title || "" : "";
  field("ev-date").value = existing ? existing.date : date || todayISO();
  field("ev-allday").checked = existing ? Boolean(existing.allDay) : false;
  field("ev-start").value = existing && existing.start ? existing.start : "";
  field("ev-end").value = existing && existing.end ? existing.end : "";
  field("ev-repeat").value = existing ? existing.repeat || "none" : "none";
  field("ev-place").value = existing ? existing.place || "" : "";
  field("ev-note").value = existing ? existing.note || "" : "";

  const times = form.querySelector("[data-times]");
  const syncTimes = () => { times.hidden = field("ev-allday").checked; };
  field("ev-allday").addEventListener("change", syncTimes);
  syncTimes();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = field("ev-title").value.trim();
    const day = field("ev-date").value;
    const allDay = field("ev-allday").checked;
    const start = allDay ? "" : field("ev-start").value;
    const end = allDay ? "" : field("ev-end").value;

    const problem =
      !title ? ["ev-title", "Donne un nom à l’événement."] :
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ? ["ev-date", "Choisis une date."] :
      !allDay && !start ? ["ev-start", "Indique l’heure de début, ou active « Toute la journée »."] :
      !allDay && end && end <= start ? ["ev-end", "L’heure de fin doit être après le début."] : null;
    if (problem) {
      message.textContent = problem[1];
      field(problem[0]).focus();
      return;
    }

    saveEvent({
      id: existing ? existing.id : undefined,
      title, date: day, allDay, start, end,
      repeat: field("ev-repeat").value,
      place: field("ev-place").value.trim(),
      note: field("ev-note").value.trim(),
    });
    sheet.close();
    showToast(existing ? "Événement modifié" : "Événement ajouté");
  });

  const deleteButton = form.querySelector("[data-delete]");
  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      // First tap: asks to confirm. Second tap: deletes.
      if (!deleteButton.classList.contains("is-armed")) {
        deleteButton.classList.add("is-armed");
        deleteButton.querySelector("span").textContent = "Confirmer la suppression";
        return;
      }
      deleteEvent(existing.id);
      sheet.close();
      showToast("Événement supprimé");
    });
  }

  // On a laptop, the cursor goes straight into the title of a new event.
  if (!existing && window.matchMedia("(pointer: fine)").matches) setTimeout(() => field("ev-title").focus({ preventScroll: true }), 420);
  return true;
}
