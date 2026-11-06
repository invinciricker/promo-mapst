/* =====================================================================================
   personal.js: the personal events added with « + » (colour Citron).

   They are saved on this phone only (see core/storage.js). From Phase 4 they will also be
   synced with the account. An event looks like this:
     { id, title, date: "2026-11-17", allDay: false, start: "17:00", end: "18:00",
       repeat: "none" | "weekly" | "monthly", place, note, createdAt, updatedAt }
   ===================================================================================== */

import { load, save, newId } from "../core/storage.js";
import { parseISO, daysBetween } from "../core/dates.js";

const KEY = "events";
let events = load(KEY, []);
if (!Array.isArray(events)) events = [];
const listeners = new Set();

/** Calls `fn` every time the events change. */
export function onPersonalChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function changed() {
  save(KEY, events);
  listeners.forEach((fn) => fn());
}

export function getEvent(id) {
  return events.find((e) => e.id === id) || null;
}

export function countEvents() {
  return events.length;
}

/** Adds or updates an event. Returns the saved event. */
export function saveEvent(input) {
  const now = new Date().toISOString();
  const existing = input.id ? getEvent(input.id) : null;
  const event = {
    ...(existing || {}),
    ...input,
    id: existing ? existing.id : newId(),
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };
  events = existing ? events.map((e) => (e.id === event.id ? event : e)) : events.concat(event);
  changed();
  return event;
}

export function deleteEvent(id) {
  events = events.filter((e) => e.id !== id);
  changed();
}

/** Does the event happen on this day? (takes « every week / every month » into account) */
function happensOn(event, iso) {
  if (!event.date || iso < event.date) return false;
  if (event.repeat === "weekly") return daysBetween(parseISO(event.date), parseISO(iso)) % 7 === 0;
  if (event.repeat === "monthly") return parseISO(event.date).getDate() === parseISO(iso).getDate();
  return iso === event.date;
}

/** The personal events of one day, ready to show (sorted by time, all-day first). */
export function personalOn(iso) {
  return events
    .filter((e) => happensOn(e, iso))
    .map((e) => ({
      id: `${e.id}@${iso}`,
      eventId: e.id,
      kind: "perso",
      cat: "perso",
      iso,
      title: e.title || "Sans titre",
      start: !e.allDay && e.start ? e.start : null,
      end: !e.allDay && e.start && e.end && e.end > e.start ? e.end : null,
      allDay: Boolean(e.allDay || !e.start),
      place: e.place || "",
      note: e.note || "",
      repeat: e.repeat || "none",
    }))
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""));
}
