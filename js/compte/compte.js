/* =====================================================================================
   compte.js: the account on this phone, and everything the screens ask the backend
   (Phase 6). The screens never call backend.js themselves: they call the functions here.

   Saved on the phone:
     "promo-mapst:compte"            { pseudo, cle, classement: true|false, sync: ms }
                                     who I am, and when the progress was last saved online
     "promo-mapst:modifie"           when the progress last changed on this phone (ms)
     "promo-mapst:cache-classement"  the last classement read, for offline
     "promo-mapst:cache-questions"   the last list of questions read, for offline

   Which backend:
     - js/compte/backend.js (Firebase) when js/compte/config.js has a project;
     - js/compte/backend-faux.js with ?backend=faux on the computer (the tests);
     - Firebase's emulators with ?backend=emulateur on the computer (tests/test_rules.py).
   With an empty config and no test backend, comptesActifs() is false and every account
   feature is hidden.

   The sync of the progress (« promo-mapst:reviser » and « promo-mapst:lecons »):
     - at launch if signed in and online; 5 s after each finished lesson, quiz or review
       (several changes in one write); when the app goes to the background with something
       unsent; when the connection comes back;
     - each time: read the profile, merge (fusionnerProgres in regles.js), save the result
       on the phone if it changed (then the screens are drawn again), write it online if
       it changed. Never more than one write every 15 s. Failures are silent: it tries
       again at the next occasion.
     - then, if I appear in the classement, my line (the XP of the week, with the caps of
       the rules: scoreAEnvoyer in regles.js), at least 10 s after the previous one.
   ===================================================================================== */

import { load, save, remove, watchSaves } from "../core/storage.js";
import { refreshPages } from "../core/nav.js";
import { reloadProgress } from "../reviser/progress.js";
import { firebaseConfig, DOMAINE } from "./config.js";
import { pseudoOk, fusionnerProgres, memesDonnees, semaineISO, xpSemaine, scoreAEnvoyer } from "./regles.js";

const KEY = "compte";
const CHANGED = "modifie";
const SYNCED = ["reviser", "lecons"];          // the keys saved online (nothing else)
const AFTER = 5000;                            // wait after a lesson, to group changes
const WRITE_GAP = 15000;                       // at most one write of the progress every 15 s
const SCORE_GAP = 10500;                       // at least 10 s between two classement lines

const erreur = (code) => Object.assign(new Error(code), { code });

// -------------------------------------------------------------------------------------
// Which backend, and is there one at all
// -------------------------------------------------------------------------------------
const onComputer = () => ["localhost", "127.0.0.1", "[::1]", "::1"].includes(location.hostname);

/** "firebase", "faux", "emulateur", or null when accounts are switched off. */
export function backendMode() {
  const asked = new URLSearchParams(location.search).get("backend");
  if (onComputer() && (asked === "faux" || asked === "emulateur")) return asked;
  return firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId ? "firebase" : null;
}

/** False while js/compte/config.js is empty: the app then hides every account feature. */
export const comptesActifs = () => backendMode() !== null;

let backendLoading = null;

/** The backend module, loaded the first time it is needed. */
function backend() {
  if (!backendLoading) {
    const mode = backendMode();
    if (!mode) return Promise.reject(erreur("inconnu"));
    backendLoading = (mode === "faux" ? import("./backend-faux.js") : import("./backend.js")).then((b) => {
      const query = new URLSearchParams(location.search);
      b.init({
        config: mode === "emulateur" ? { apiKey: "demo-key", authDomain: "demo-promo.firebaseapp.com", projectId: query.get("projet") || "demo-promo", appId: "demo" } : firebaseConfig,
        domaine: DOMAINE,
        emulateur: mode === "emulateur" ? { auth: Number(query.get("auth")) || 9099, firestore: Number(query.get("firestore")) || 8085 } : null,
      });
      return b;
    });
    backendLoading.catch(() => { backendLoading = null; });
  }
  return backendLoading;
}

/** Every action the person asks for: « Pas de connexion » straight away when offline. */
async function act(job) {
  if (!navigator.onLine) throw erreur("hors-ligne");
  return job(await backend().catch(() => { throw erreur("hors-ligne"); }));
}

// -------------------------------------------------------------------------------------
// Who I am, on this phone
// -------------------------------------------------------------------------------------

/** { pseudo, cle, classement, sync } or null when nobody is signed in on this phone. */
export function compte() {
  if (!comptesActifs()) return null;
  const c = load(KEY, null);
  if (!c || typeof c !== "object" || !pseudoOk(c.pseudo)) return null;
  return { pseudo: c.pseudo, cle: c.pseudo.toLowerCase(), classement: c.classement === true, sync: Number.isFinite(c.sync) ? c.sync : 0 };
}

function setCompte(value) {
  if (value) save(KEY, { pseudo: value.pseudo, cle: value.pseudo.toLowerCase(), classement: Boolean(value.classement), sync: value.sync || 0 });
  else remove(KEY);
  window.dispatchEvent(new CustomEvent("compte-change"));
}

/** Forgets the account on this phone (the progress stays). */
function forget() {
  remove("cache-classement");
  remove("cache-questions");
  admin = null;
  sentScore = null;
  sessionChecked = false;
  clearTimeout(timer);
  setCompte(null);
}

/** Something changed on this phone that is not online yet? */
export function nonEnvoye() {
  const c = compte();
  return Boolean(c) && load(CHANGED, 0) > c.sync;
}

// -------------------------------------------------------------------------------------
// The progress, as saved online: { v: 1, reviser, lecons }
// -------------------------------------------------------------------------------------
let applying = false;                  // true while a merge is saved on the phone

// Each change of the progress on this phone is dated (used by the merge and nonEnvoye).
watchSaves((key) => {
  if (!applying && SYNCED.includes(key)) save(CHANGED, Date.now());
});

const localProgress = () => ({ reviser: load("reviser", null), lecons: load("lecons", {}) });
const progressText = (p) => JSON.stringify({ v: 1, reviser: p.reviser, lecons: p.lecons });

function parseProgress(text) {
  try {
    const value = JSON.parse(text || "null");
    return value && typeof value === "object" ? value : null;
  } catch (error) {
    return null;
  }
}

/** Saves a merge on the phone, then draws the screens again (like after a lesson). */
function applyLocally(merged) {
  applying = true;
  try {
    save("reviser", merged.reviser);
    save("lecons", merged.lecons);
  } finally {
    applying = false;
  }
  reloadProgress();
  refreshPages();
}

// -------------------------------------------------------------------------------------
// Sync
// -------------------------------------------------------------------------------------
let timer = null;
let running = null;
let again = false;
let lastWrite = 0;
let lastScore = 0;
let sentScore = null;                  // { semaine, xp } of my line, as far as we know
let sessionChecked = false;
let admin = null;                      // the promise of estAdmin(), once per launch

/** Plans a sync in `delay` ms (never sooner than 15 s after the last write). */
function plan(delay = AFTER) {
  if (!compte()) return;
  clearTimeout(timer);
  timer = setTimeout(() => { synchroniser(); }, Math.max(delay, WRITE_GAP - (Date.now() - lastWrite)));
}

/**
 * Is the phone still signed in? (once per launch) If the sign-in was lost (the phone
 * cleared the app's data...), the account is forgotten here: the progress stays.
 */
async function checkSession(b) {
  if (sessionChecked) return true;
  const cle = await b.utilisateur();
  const c = compte();
  if (!c) return false;
  if (cle !== c.cle) {
    forget();
    refreshPages();
    return false;
  }
  sessionChecked = true;
  return true;
}

/** One sync, now. Returns true if it went through. Several calls share the same one. */
export function synchroniser() {
  if (!compte() || !navigator.onLine) return Promise.resolve(false);
  if (running) { again = true; return running; }
  clearTimeout(timer);
  running = (async () => {
    try {
      const b = await backend();
      if (!(await checkSession(b))) return false;
      const started = Date.now();
      const profil = await b.lireProfil();
      if (!profil) return false;                   // no profile (deleted in the console?)
      const online = parseProgress(profil.progres);
      const local = localProgress();
      const merged = fusionnerProgres(local, online, { localT: load(CHANGED, 0), distantT: profil.majLe || 0 });
      // Each side "as the merge sees it" (with every field), to know what changed.
      const normal = (p) => fusionnerProgres(p, null);
      if (!memesDonnees(merged, normal(local))) applyLocally(merged);
      if (!online || !memesDonnees(merged, normal(online))) {
        const wait = WRITE_GAP - (Date.now() - lastWrite);
        if (wait > 0) { plan(wait); return false; }
        lastWrite = Date.now();
        await b.ecrireProgres(progressText(merged));
      }
      const c = compte();
      if (!c) return false;
      setCompte({ ...c, sync: started });
      if (c.classement) await writeScore(b, merged.reviser);
      return true;
    } catch (error) {
      return false;                                // silent: tried again next time
    } finally {
      running = null;
      if (again) { again = false; plan(WRITE_GAP); }
    }
  })();
  return running;
}

/** My classement line: the XP of this week, within the caps of the rules. */
async function writeScore(b, reviser, { force = false } = {}) {
  const c = compte();
  if (!c || !c.classement) return;
  const semaine = semaineISO(new Date());
  const reel = xpSemaine(reviser && reviser.days, new Date());
  if (!force && sentScore && sentScore.semaine === semaine && sentScore.xp >= reel) return;   // nothing new
  const wait = SCORE_GAP - (Date.now() - lastScore);
  if (wait > 0) { plan(Math.max(wait, AFTER)); return; }
  const line = await b.lireScore();
  const xp = scoreAEnvoyer({ reel, semaine, ligne: line });
  if (xp === null) {
    sentScore = line && line.semaine === semaine ? { semaine, xp: line.xp } : { semaine, xp: reel };
    return;
  }
  lastScore = Date.now();
  await b.ecrireScore({ pseudo: c.pseudo, xp, semaine });
  sentScore = { semaine, xp };
  if (xp < reel) plan(WRITE_GAP);                   // the rest at the next sync
}

// After each finished lesson, quiz or review: a sync 5 s later (several grouped in one).
window.addEventListener("progres-fini", () => plan(AFTER));
// The app goes to the background with something unsent: now.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && nonEnvoye()) synchroniser();
});
// The connection comes back.
window.addEventListener("online", () => { if (nonEnvoye()) plan(1000); });

/**
 * At launch (app.js, once the first screen is shown): sync if signed in and online, then
 * check once whether I am the admin.
 */
export function demarrerCompte() {
  if (!compte() || !navigator.onLine) return;
  synchroniser().then(() => { if (compte()) estAdmin(); });
}

/** Writes the progress of the phone online as it is, without merging (after « Effacer »). */
export async function remplacerEnLigne() {
  const c = compte();
  if (!c || !navigator.onLine) return;
  try {
    const b = await backend();
    lastWrite = Date.now();
    await b.ecrireProgres(progressText(localProgress()));
    setCompte({ ...compte(), sync: Date.now() });
  } catch (error) {
    /* silent: the next sync merges, as usual */
  }
}

// -------------------------------------------------------------------------------------
// Account actions (the sheets of js/screens/compte.js). Each one throws an error with a
// code (see backend.js) that the sheet turns into a sentence.
// -------------------------------------------------------------------------------------

/** Creates the account. { existait: true } when the profile was already there (repair). */
export async function creer({ pseudo, code, codePromo, classement }) {
  const result = await act((b) => b.creerCompte({ pseudo, code, codePromo, progres: progressText(localProgress()) }));
  const profilPseudo = result.profil && pseudoOk(result.profil.pseudo) ? result.profil.pseudo : pseudo;
  sessionChecked = true;
  admin = null;
  sentScore = null;
  setCompte({ pseudo: profilPseudo, classement, sync: result.existait ? 0 : Date.now() });
  synchroniser().then(() => { if (compte()) estAdmin(); });
  return { existait: result.existait, pseudo: profilPseudo };
}

/**
 * Signs in. { besoinCodePromo: true } when the profile does not exist (an account made
 * without the class code): the sheet then asks for it and calls completer().
 */
export async function connecter({ pseudo, code }) {
  const result = await act((b) => b.connecter({ pseudo, code }));
  if (!result.profil) return { besoinCodePromo: true };
  return finishSignIn(result.profil.pseudo && pseudoOk(result.profil.pseudo) ? result.profil.pseudo : pseudo);
}

/** Signed in without a profile: the class code, then the profile (step 3). */
export async function completer({ pseudo, codePromo }) {
  await act((b) => b.completerProfil({ pseudo, codePromo, progres: progressText(localProgress()) }));
  return finishSignIn(pseudo, { uploaded: true });
}

async function finishSignIn(pseudo, { uploaded = false } = {}) {
  sessionChecked = true;
  admin = null;
  sentScore = null;
  let classement = false;
  try {
    const b = await backend();
    classement = Boolean(await b.lireScore());     // I appeared in it on my other phone
  } catch (error) {
    /* not important: off */
  }
  setCompte({ pseudo, classement, sync: uploaded ? Date.now() : 0 });
  await synchroniser();
  estAdmin();
  return { pseudo };
}

/** The sheet « Code de la promo » was closed without finishing: sign out again. */
export async function abandonner() {
  try { (await backend()).deconnecter(); } catch (error) { /* nothing to do */ }
}

/** « Me déconnecter »: what is not sent yet goes first (if possible); the progress stays. */
export async function deconnecter() {
  if (nonEnvoye()) await Promise.race([synchroniser(), new Promise((resolve) => setTimeout(resolve, 4000))]);
  try { await (await backend()).deconnecter(); } catch (error) { /* signed out here anyway */ }
  forget();
}

export async function changerCode({ ancien, nouveau }) {
  await act((b) => b.changerCode({ ancien, nouveau }));
}

/** « Supprimer mon compte »: everything online; the progress stays on the phone. */
export async function supprimer({ code }) {
  await act((b) => b.supprimerCompte({ code }));
  forget();
}

/** « Apparaître dans le classement » on or off. Off deletes my line. */
export async function reglerClassement(on) {
  const c = compte();
  if (!c) return;
  await act(async (b) => {
    if (on) {
      setCompte({ ...c, classement: true });
      sentScore = null;
      await writeScore(b, load("reviser", null), { force: true });
    } else {
      await b.retirerScore();
      sentScore = null;
      setCompte({ ...compte(), classement: false });
    }
  });
}

/** Am I the admin? Checked once per launch (false when unsure). */
export function estAdmin() {
  if (!compte()) return Promise.resolve(false);
  if (!admin) {
    admin = backend().then((b) => b.estAdmin()).catch(() => { admin = null; return false; });
    admin.then((yes) => { if (yes) window.dispatchEvent(new CustomEvent("compte-change")); });
  }
  return admin;
}

// -------------------------------------------------------------------------------------
// The classement and the questions: read online, kept on the phone for offline
// -------------------------------------------------------------------------------------

/** The lines of this week, best first: [{ cle, pseudo, xp }]. Saved for offline. */
export async function chargerClassement() {
  const semaine = semaineISO(new Date());
  const lines = await act((b) => b.lireClassement());
  const week = lines.filter((l) => l.semaine === semaine && l.xp > 0)
    .sort((a, b) => b.xp - a.xp || a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" }))
    .map(({ cle, pseudo, xp }) => ({ cle, pseudo, xp }));
  save("cache-classement", { semaine, lignes: week, at: Date.now() });
  return { lignes: week, at: Date.now() };
}

/** The last classement read on this phone (only if it is this week's), or null. */
export function classementEnCache() {
  const saved = load("cache-classement", null);
  if (!saved || !Array.isArray(saved.lignes) || saved.semaine !== semaineISO(new Date())) return null;
  return { lignes: saved.lignes, at: saved.at || 0 };
}

/** The questions, newest first. Saved for offline. */
export async function chargerQuestions() {
  const list = await act((b) => b.listerQuestions());
  save("cache-questions", { list, at: Date.now() });
  return { list, at: Date.now() };
}

export function questionsEnCache() {
  const saved = load("cache-questions", null);
  return saved && Array.isArray(saved.list) ? { list: saved.list, at: saved.at || 0 } : null;
}

/** Changes one question in the saved list (after « Moi aussi », an answer...). */
function updateCached(id, change) {
  const saved = questionsEnCache();
  if (!saved) return;
  const list = saved.list.map((q) => (q.id === id ? change(q) : q)).filter(Boolean);
  save("cache-questions", { list, at: saved.at });
}

export async function poser({ texte, chapitre }) {
  const c = compte();
  if (!c) throw erreur("non-connecte");
  return act((b) => b.poserQuestion({ texte, chapitre, pseudo: c.pseudo }));
}

export async function moiAussi(id, on) {
  const c = compte();
  if (!c) throw erreur("non-connecte");
  await act((b) => b.basculerAussi(id, on));
  updateCached(id, (q) => ({ ...q, aussi: on ? [...new Set([...q.aussi, c.cle])] : q.aussi.filter((x) => x !== c.cle) }));
}

export async function repondre(id, texte) {
  await act((b) => b.repondre(id, texte));
  updateCached(id, (q) => ({ ...q, reponse: texte, reponduLe: Date.now() }));
}

export async function supprimerQuestion(id) {
  await act((b) => b.supprimerQuestion(id));
  updateCached(id, () => null);
}
