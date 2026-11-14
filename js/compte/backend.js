/* =====================================================================================
   backend.js: the only file that talks to Firebase (Phase 6).

   Everything else calls its functions (through js/compte/compte.js). Each one either
   returns what was asked or throws an error with one of these codes, which the screens
   turn into a French sentence:
     "pseudo-pris"   the pseudo already has an account
     "identifiants"  wrong pseudo or code
     "trop-essais"   too many wrong codes: wait a few minutes
     "code-promo"    the class code is not right
     "hors-ligne"    no connection (or no answer after 15 seconds)
     "refuse"        the database rules said no
     "non-connecte"  nobody is signed in on this phone
     "inconnu"       anything else

   Firebase is the modular SDK, three files copied into vendor/firebase/ by
   scripts/fetch_firebase.sh (version in vendor/firebase/VERSION). They are only loaded
   the first time they are needed (load() below), so the app starts as fast as without.
   Firestore « Lite » on purpose: plain reads and writes, no live listeners.

   The data (the rules are docs/firebase/firestore.rules, written by Claude chat):
     membres/<cle>      pseudo, code (the class code), creeLe, progres (JSON text), majLe
     classement/<cle>   pseudo, xp (of the week), semaine (« 2026-W46 »), majLe
     questions/<id>     texte, auteur (cle), pseudo, chapitre, creeLe, reponse, aussi,
                        and reponduLe once answered
     admins/<cle>       created by hand by the owner; the app only reads its own
   Every date is serverTimestamp(): the rules require it.
   <cle> is the pseudo in lowercase; the hidden address is <cle>@<DOMAINE>.
   ===================================================================================== */

const VENDOR = "../../vendor/firebase/";
const TIMEOUT = 15000;

let settings = null;       // { config, domaine, emulateur } from init()
let loading = null;        // the promise of the loaded SDK: { auth, db, A, F }

const erreur = (code) => Object.assign(new Error(code), { code });

/** Called once by compte.js. emulateur: true on the computer, for tests/test_rules.py. */
export function init(options) {
  settings = options;
}

/** Loads the three Firebase files and starts Auth and Firestore (once). */
function load() {
  if (!loading) {
    loading = (async () => {
      const [appModule, A, F] = await Promise.all([
        import(`${VENDOR}firebase-app.js`),
        import(`${VENDOR}firebase-auth.js`),
        import(`${VENDOR}firebase-firestore-lite.js`),
      ]);
      const app = appModule.initializeApp(settings.config);
      // Kept signed in on the phone (IndexedDB, else localStorage). No popup or redirect
      // helper: nothing is ever loaded from another website.
      const auth = A.initializeAuth(app, { persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence] });
      const db = F.getFirestore(app);
      if (settings.emulateur) {
        A.connectAuthEmulator(auth, `http://127.0.0.1:${settings.emulateur.auth}`, { disableWarnings: true });
        F.connectFirestoreEmulator(db, "127.0.0.1", settings.emulateur.firestore);
      }
      await auth.authStateReady();
      return { auth, db, A, F };
    })();
    loading.catch(() => { loading = null; });       // try again next time
  }
  return loading;
}

const adresse = (cle) => `${cle}@${settings.domaine}`;

/** The pseudo in lowercase of who is signed in, or "" (from the hidden address). */
function cleOf(user) {
  return user && user.email ? user.email.split("@")[0] : "";
}

/** A Firebase error -> one of the codes at the top of this file. */
function traduire(error) {
  if (error && error.code && !String(error.code).includes("/") && error.code in CODES) return error;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return erreur("hors-ligne");
  const code = String((error && error.code) || "");
  if (code === "auth/email-already-in-use") return erreur("pseudo-pris");
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials",
    "auth/invalid-email", "auth/user-mismatch", "auth/requires-recent-login"].includes(code)) return erreur("identifiants");
  if (code === "auth/too-many-requests") return erreur("trop-essais");
  if (["auth/network-request-failed", "unavailable", "deadline-exceeded", "auth/timeout"].includes(code)) return erreur("hors-ligne");
  if (code === "permission-denied" || code === "unauthenticated") return erreur("refuse");
  console.error("Firebase :", error);
  return erreur("inconnu");
}
const CODES = { "pseudo-pris": 1, identifiants: 1, "trop-essais": 1, "code-promo": 1, "hors-ligne": 1, refuse: 1, "non-connecte": 1, inconnu: 1 };

/** Runs a Firebase job: no answer after 15 s counts as « hors ligne ». */
async function run(job) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw erreur("hors-ligne");
  let timer = null;
  const late = new Promise((resolve, reject) => { timer = setTimeout(() => reject(erreur("hors-ligne")), TIMEOUT); });
  try {
    return await Promise.race([(async () => job(await load()))(), late]);
  } catch (error) {
    throw traduire(error);
  } finally {
    clearTimeout(timer);
  }
}

/** The person signed in, or an error "non-connecte". */
function who(sdk) {
  const user = sdk.auth.currentUser;
  if (!user) throw erreur("non-connecte");
  return { user, cle: cleOf(user) };
}

/** A Firestore date -> milliseconds (0 when missing). */
const ms = (value) => (value && typeof value.toMillis === "function" ? value.toMillis() : 0);

function profilOf(snapshot) {
  if (!snapshot.exists()) return null;
  const d = snapshot.data();
  return { pseudo: d.pseudo, progres: typeof d.progres === "string" ? d.progres : "", majLe: ms(d.majLe) };
}

// -------------------------------------------------------------------------------------
// The account
// -------------------------------------------------------------------------------------

/** The pseudo in lowercase of who is signed in on this phone, or null. */
export async function utilisateur() {
  const sdk = await load();
  return cleOf(sdk.auth.currentUser) || null;
}

/**
 * Creating an account, in the order of docs/phases/phase-6.md:
 *   1. the sign-in account (address + code)
 *   2. the profile exists already (a forgotten code being repaired): nothing written
 *   3. else the profile, with the class code; refused -> the sign-in account is deleted
 * Returns { existait } (true in case 2).
 */
export function creerCompte({ pseudo, code, codePromo, progres }) {
  return run(async ({ auth, db, A, F }) => {
    const cle = pseudo.toLowerCase();
    const { user } = await A.createUserWithEmailAndPassword(auth, adresse(cle), code);
    const ref = F.doc(db, "membres", cle);
    try {
      const snapshot = await F.getDoc(ref);
      if (snapshot.exists()) return { existait: true, profil: profilOf(snapshot) };
      await F.setDoc(ref, { pseudo, code: codePromo, creeLe: F.serverTimestamp(), progres, majLe: F.serverTimestamp() });
      return { existait: false };
    } catch (error) {
      // No profile: the pseudo must not stay taken. Delete the sign-in account again.
      await A.deleteUser(user).catch(() => A.signOut(auth).catch(() => null));
      if (error && error.code === "permission-denied") throw erreur("code-promo");
      throw error;
    }
  });
}

/** Signed in, but no profile (made without the class code): step 3 only. */
export function completerProfil({ pseudo, codePromo, progres }) {
  return run(async (sdk) => {
    const { cle } = who(sdk);
    const { db, F } = sdk;
    try {
      await F.setDoc(F.doc(db, "membres", cle), { pseudo, code: codePromo, creeLe: F.serverTimestamp(), progres, majLe: F.serverTimestamp() });
    } catch (error) {
      if (error && error.code === "permission-denied") throw erreur("code-promo");
      throw error;
    }
  });
}

/** Signs in. Returns { profil } (null when the profile does not exist yet). */
export function connecter({ pseudo, code }) {
  return run(async ({ auth, db, A, F }) => {
    const cle = pseudo.toLowerCase();
    await A.signInWithEmailAndPassword(auth, adresse(cle), code);
    return { profil: profilOf(await F.getDoc(F.doc(db, "membres", cle))) };
  });
}

export async function deconnecter() {
  const { auth, A } = await load();
  await A.signOut(auth);
}

/** Changes the code: the current one first (reauthenticate), then the new one. */
export function changerCode({ ancien, nouveau }) {
  return run(async (sdk) => {
    const { user } = who(sdk);
    const { A } = sdk;
    await A.reauthenticateWithCredential(user, A.EmailAuthProvider.credential(user.email, ancien));
    await A.updatePassword(user, nouveau);
  });
}

/**
 * Deletes everything, in this order: reauthenticate, my questions, my classement line,
 * my profile, then the sign-in account.
 */
export function supprimerCompte({ code }) {
  return run(async (sdk) => {
    const { user, cle } = who(sdk);
    const { db, A, F } = sdk;
    await A.reauthenticateWithCredential(user, A.EmailAuthProvider.credential(user.email, code));
    const mine = await F.getDocs(F.query(F.collection(db, "questions"), F.where("auteur", "==", cle)));
    for (const q of mine.docs) await F.deleteDoc(q.ref);
    await F.deleteDoc(F.doc(db, "classement", cle));
    await F.deleteDoc(F.doc(db, "membres", cle));
    await A.deleteUser(user);
  });
}

/** My profile: { pseudo, progres, majLe } or null. */
export function lireProfil() {
  return run(async (sdk) => {
    const { cle } = who(sdk);
    return profilOf(await sdk.F.getDoc(sdk.F.doc(sdk.db, "membres", cle)));
  });
}

/** Saves my progress (one JSON text). */
export function ecrireProgres(progres) {
  return run(async (sdk) => {
    const { cle } = who(sdk);
    const { db, F } = sdk;
    await F.updateDoc(F.doc(db, "membres", cle), { progres, majLe: F.serverTimestamp() });
  });
}

// -------------------------------------------------------------------------------------
// The classement
// -------------------------------------------------------------------------------------
function lineOf(snapshot) {
  const d = snapshot.data();
  return { cle: snapshot.id, pseudo: String(d.pseudo || snapshot.id), xp: Number(d.xp) || 0, semaine: String(d.semaine || ""), majLe: ms(d.majLe) };
}

/** My own line, or null. */
export function lireScore() {
  return run(async (sdk) => {
    const { cle } = who(sdk);
    const snapshot = await sdk.F.getDoc(sdk.F.doc(sdk.db, "classement", cle));
    return snapshot.exists() ? lineOf(snapshot) : null;
  });
}

/** Every line (100 at most), whatever the week: compte.js keeps those of this week. */
export function lireClassement() {
  return run(async (sdk) => {
    who(sdk);
    const { db, F } = sdk;
    const result = await F.getDocs(F.query(F.collection(db, "classement"), F.limit(100)));
    return result.docs.map(lineOf);
  });
}

export function ecrireScore({ pseudo, xp, semaine }) {
  return run(async (sdk) => {
    const { cle } = who(sdk);
    const { db, F } = sdk;
    await F.setDoc(F.doc(db, "classement", cle), { pseudo, xp, semaine, majLe: F.serverTimestamp() });
  });
}

export function retirerScore() {
  return run(async (sdk) => {
    const { cle } = who(sdk);
    await sdk.F.deleteDoc(sdk.F.doc(sdk.db, "classement", cle));
  });
}

// -------------------------------------------------------------------------------------
// Questions de la promo
// -------------------------------------------------------------------------------------
function questionOf(snapshot) {
  const d = snapshot.data();
  return {
    id: snapshot.id,
    texte: String(d.texte || ""),
    auteur: String(d.auteur || ""),
    pseudo: String(d.pseudo || d.auteur || ""),
    chapitre: String(d.chapitre || ""),
    creeLe: ms(d.creeLe),
    reponse: String(d.reponse || ""),
    reponduLe: ms(d.reponduLe),
    aussi: Array.isArray(d.aussi) ? d.aussi.map(String) : [],
  };
}

/** The 100 newest questions, newest first. */
export function listerQuestions() {
  return run(async (sdk) => {
    who(sdk);
    const { db, F } = sdk;
    const result = await F.getDocs(F.query(F.collection(db, "questions"), F.orderBy("creeLe", "desc"), F.limit(100)));
    return result.docs.map(questionOf);
  });
}

/** Asks a question. Returns its id. */
export function poserQuestion({ texte, chapitre, pseudo }) {
  return run(async (sdk) => {
    const { cle } = who(sdk);
    const { db, F } = sdk;
    const ref = await F.addDoc(F.collection(db, "questions"), {
      texte, auteur: cle, pseudo, chapitre, creeLe: F.serverTimestamp(), reponse: "", aussi: [],
    });
    return ref.id;
  });
}

/** « Moi aussi » on (true) or off (false). */
export function basculerAussi(id, on) {
  return run(async (sdk) => {
    const { cle } = who(sdk);
    const { db, F } = sdk;
    await F.updateDoc(F.doc(db, "questions", id), { aussi: on ? F.arrayUnion(cle) : F.arrayRemove(cle) });
  });
}

/** The admin answers (or changes the answer). */
export function repondre(id, texte) {
  return run(async (sdk) => {
    who(sdk);
    const { db, F } = sdk;
    await F.updateDoc(F.doc(db, "questions", id), { reponse: texte, reponduLe: F.serverTimestamp() });
  });
}

/** Deletes a question (its author, or the admin). */
export function supprimerQuestion(id) {
  return run(async (sdk) => {
    who(sdk);
    await sdk.F.deleteDoc(sdk.F.doc(sdk.db, "questions", id));
  });
}

/** Am I the admin? (a document admins/<my cle> exists, created by hand by the owner) */
export function estAdmin() {
  return run(async (sdk) => {
    const { cle } = who(sdk);
    return (await sdk.F.getDoc(sdk.F.doc(sdk.db, "admins", cle))).exists();
  });
}
