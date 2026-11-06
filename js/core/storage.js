/* =====================================================================================
   storage.js: saves small things on the phone (in the browser's "localStorage").

   What is saved stays on this phone only: nothing is sent anywhere. From Phase 4 the
   personal data will also be synced with the account.
   Every key starts with "promo-mapst:" so it never mixes with another site.
   ===================================================================================== */

const PREFIX = "promo-mapst:";

/** Reads a value; returns `fallback` if there is nothing (or if storage is blocked). */
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

/** Saves a value; returns false if the phone refused (private mode, storage full...). */
export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (error) {
    /* nothing to do */
  }
}

/** A short random id, for a new personal event. */
export function newId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
