/* =====================================================================================
   storage.js: saves small things on the phone (in the browser's "localStorage").

   What is saved stays on this phone. Since Phase 6, with an account, the progress of
   Réviser and of the lessons is also saved online (js/compte/compte.js listens to the
   saves with watchSaves() below).
   Every key starts with "promo-mapst:" so it never mixes with another site.
   ===================================================================================== */

const PREFIX = "promo-mapst:";
const watchers = [];      // functions(key) called after each save or remove

/** Calls fn(key) after each save() and remove() (the account notes what changed). */
export function watchSaves(fn) {
  watchers.push(fn);
}

function tell(key) {
  for (const fn of watchers) {
    try { fn(key); } catch (error) { /* a watcher must never break a save */ }
  }
}

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
    tell(key);
    return true;
  } catch (error) {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
    tell(key);
  } catch (error) {
    /* nothing to do */
  }
}

/** A short random id, for a new personal event. */
export function newId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
