/* =====================================================================================
   user.js: the first name (or nickname) and the welcome screen, saved on this phone only.

     "promo-mapst:prenom"      the first name, 20 characters at most (or nothing)
     "promo-mapst:bienvenue"   true once the welcome screen has been seen
   In Phase 4 the account will take the place of the « Ton prénom » step of the welcome;
   the greeting keeps the first name, which stays on the phone.
   ===================================================================================== */

import { load, save, remove } from "./storage.js";

export const NAME_MAX = 20;
const NAME_KEY = "prenom";
const WELCOME_KEY = "bienvenue";

/** One line, no extra spaces, 20 characters at most. */
export function cleanName(text) {
  return Array.from(String(text || "").replace(/\s+/g, " ").trim()).slice(0, NAME_MAX).join("").trim();
}

export function firstName() {
  const saved = load(NAME_KEY, "");
  return typeof saved === "string" ? cleanName(saved) : "";
}

/** Saves the first name (an empty text removes it), then tells the screens. */
export function setFirstName(text) {
  const name = cleanName(text);
  if (name) save(NAME_KEY, name);
  else remove(NAME_KEY);
  window.dispatchEvent(new CustomEvent("prenom-change"));
  return name;
}

/** « S » for « Sam »; "" without a name (a person icon is shown instead). */
export function initial(name = firstName()) {
  const letter = Array.from(name).find((c) => /\p{L}|\p{N}/u.test(c));
  return letter ? letter.toLocaleUpperCase("fr-FR") : "";
}

export function welcomeDone() {
  return load(WELCOME_KEY, false) === true;
}

export function setWelcomeDone(done = true) {
  if (done) save(WELCOME_KEY, true);
  else remove(WELCOME_KEY);
}
