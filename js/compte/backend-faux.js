/* =====================================================================================
   backend-faux.js: a pretend Firebase, kept in this browser, for the tests (Phase 6).

   It has exactly the functions of backend.js and follows the same database rules
   (docs/firebase/firestore.rules): the class code, one profile per pseudo, the caps of
   the classement, who may answer or delete a question. Nothing leaves the computer.

   Used only when the address has ?backend=faux and the app runs on the computer itself
   (localhost or 127.0.0.1): http://localhost:8000/?backend=faux#accueil
   On GitHub Pages the parameter is ignored.

   Its "server" is saved in the browser under "faux-backend" (outside the app's keys), so
   it survives a reload, like the real one. The tests prepare it before the app starts:
       localStorage["faux-backend"] = JSON.stringify({ codes: ["mapst-test"], admins: ["prof"] })
   and read it, or change its clock, through window.fauxBackend (see the bottom).
   Defaults: the class code « mapst-test », no admin.
   ===================================================================================== */

const STORE = "faux-backend";
const SESSION = "faux-backend:session";
const MAX_TRIES = 5;                 // wrong codes in a row before « trop d'essais »
const DELAY = 40;                    // a small wait, like the network

let shift = 0;                       // the tests can move the clock of the "server"
const now = () => Date.now() + shift;

const erreur = (code) => Object.assign(new Error(code), { code });

function read() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORE) || "null"); } catch (error) { s = null; }
  s = s && typeof s === "object" ? s : {};
  return {
    codes: Array.isArray(s.codes) ? s.codes : ["mapst-test"],
    admins: Array.isArray(s.admins) ? s.admins : [],
    users: s.users || {},              // cle -> { code, tries }
    membres: s.membres || {},
    classement: s.classement || {},
    questions: s.questions || {},
    log: Array.isArray(s.log) ? s.log : [],   // what was written, for the tests
    fail: s.fail || null,              // a function name that must fail once (tests)
  };
}

function write(s) {
  localStorage.setItem(STORE, JSON.stringify(s));
}

/** Who is signed in on this "phone" (like Firebase Auth, it stays after a reload). */
function me() {
  return localStorage.getItem(SESSION) || null;
}

/** Every call: offline? a wait, then the work, then the save. */
async function call(name, work, { signedIn = true } = {}) {
  if (!navigator.onLine) throw erreur("hors-ligne");
  await new Promise((resolve) => setTimeout(resolve, DELAY));
  if (!navigator.onLine) throw erreur("hors-ligne");
  const s = read();
  if (s.fail === name) { s.fail = null; write(s); throw erreur("hors-ligne"); }
  if (signedIn && !me()) throw erreur("non-connecte");
  const result = work(s, me());
  write(s);
  return result;
}

const isMember = (s, cle) => Boolean(cle && s.membres[cle]);
const copy = (value) => JSON.parse(JSON.stringify(value));

export function init() {
  /* nothing to load */
}

export async function utilisateur() {
  return me();
}

// -------------------------------------------------------------------------------------
// The account
// -------------------------------------------------------------------------------------
export function creerCompte({ pseudo, code, codePromo, progres }) {
  return call("creerCompte", (s) => {
    const cle = pseudo.toLowerCase();
    if (s.users[cle]) throw erreur("pseudo-pris");
    s.users[cle] = { code, tries: 0 };
    if (s.membres[cle]) {                            // a forgotten code being repaired
      localStorage.setItem(SESSION, cle);
      return { existait: true, profil: copy(s.membres[cle]) };
    }
    if (!s.codes.includes(codePromo)) {              // refused: the Auth user is deleted
      delete s.users[cle];
      throw erreur("code-promo");
    }
    s.membres[cle] = { pseudo, code: codePromo, creeLe: now(), progres, majLe: now() };
    s.log.push({ op: "creer", cle });
    localStorage.setItem(SESSION, cle);
    return { existait: false };
  }, { signedIn: false });
}

export function completerProfil({ pseudo, codePromo, progres }) {
  return call("completerProfil", (s, cle) => {
    if (pseudo.toLowerCase() !== cle) throw erreur("refuse");
    if (!s.codes.includes(codePromo)) throw erreur("code-promo");
    s.membres[cle] = { pseudo, code: codePromo, creeLe: now(), progres, majLe: now() };
    s.log.push({ op: "completer", cle });
  });
}

export function connecter({ pseudo, code }) {
  return call("connecter", (s) => {
    const cle = pseudo.toLowerCase();
    const user = s.users[cle];
    if (user && user.tries >= MAX_TRIES) throw erreur("trop-essais");
    if (!user || user.code !== code) {
      if (user) user.tries += 1;
      write(s);
      throw erreur("identifiants");
    }
    user.tries = 0;
    localStorage.setItem(SESSION, cle);
    return { profil: s.membres[cle] ? copy(s.membres[cle]) : null };
  }, { signedIn: false });
}

export async function deconnecter() {
  localStorage.removeItem(SESSION);
}

export function changerCode({ ancien, nouveau }) {
  return call("changerCode", (s, cle) => {
    if (!s.users[cle] || s.users[cle].code !== ancien) throw erreur("identifiants");
    s.users[cle].code = nouveau;
  });
}

export function supprimerCompte({ code }) {
  return call("supprimerCompte", (s, cle) => {
    if (!s.users[cle] || s.users[cle].code !== code) throw erreur("identifiants");
    for (const [id, q] of Object.entries(s.questions)) if (q.auteur === cle) delete s.questions[id];
    delete s.classement[cle];
    delete s.membres[cle];
    delete s.users[cle];
    s.log.push({ op: "supprimer", cle });
    localStorage.removeItem(SESSION);
  });
}

export function lireProfil() {
  return call("lireProfil", (s, cle) => (s.membres[cle] ? copy(s.membres[cle]) : null));
}

export function ecrireProgres(progres) {
  return call("ecrireProgres", (s, cle) => {
    if (!s.membres[cle]) throw erreur("refuse");
    if (typeof progres !== "string" || progres.length > 200000) throw erreur("refuse");
    s.membres[cle].progres = progres;
    s.membres[cle].majLe = now();
    s.log.push({ op: "progres", cle, at: now() });
  });
}

// -------------------------------------------------------------------------------------
// The classement (the rules of « classement » in firestore.rules)
// -------------------------------------------------------------------------------------
export function lireScore() {
  return call("lireScore", (s, cle) => {
    if (!isMember(s, cle)) throw erreur("refuse");
    return s.classement[cle] ? copy(s.classement[cle]) : null;
  });
}

export function lireClassement() {
  return call("lireClassement", (s, cle) => {
    if (!isMember(s, cle)) throw erreur("refuse");
    return Object.entries(s.classement).slice(0, 100).map(([id, line]) => ({ cle: id, ...copy(line) }));
  });
}

export function ecrireScore({ pseudo, xp, semaine }) {
  return call("ecrireScore", (s, cle) => {
    if (!isMember(s, cle) || pseudo.toLowerCase() !== cle) throw erreur("refuse");
    if (!Number.isInteger(xp) || xp < 0 || xp > 20000 || !/^20[0-9]{2}-W[0-9]{2}$/.test(semaine)) throw erreur("refuse");
    const before = s.classement[cle];
    if (!before) {
      if (xp > 3000) throw erreur("refuse");
    } else {
      if (now() <= before.majLe + 10000) throw erreur("refuse");
      const sameWeek = semaine === before.semaine && xp >= before.xp && xp - before.xp <= 400;
      const newWeek = semaine > before.semaine && xp <= 400;
      if (!sameWeek && !newWeek) throw erreur("refuse");
    }
    s.classement[cle] = { pseudo, xp, semaine, majLe: now() };
    s.log.push({ op: "score", cle, xp, semaine, at: now() });
  });
}

export function retirerScore() {
  return call("retirerScore", (s, cle) => {
    delete s.classement[cle];
    s.log.push({ op: "retirer", cle });
  });
}

// -------------------------------------------------------------------------------------
// Questions de la promo
// -------------------------------------------------------------------------------------
export function listerQuestions() {
  return call("listerQuestions", (s, cle) => {
    if (!isMember(s, cle)) throw erreur("refuse");
    return Object.entries(s.questions).map(([id, q]) => ({ id, ...copy(q) }))
      .sort((a, b) => b.creeLe - a.creeLe).slice(0, 100);
  });
}

export function poserQuestion({ texte, chapitre, pseudo }) {
  return call("poserQuestion", (s, cle) => {
    if (!isMember(s, cle) || pseudo.toLowerCase() !== cle) throw erreur("refuse");
    if (typeof texte !== "string" || texte.length < 3 || texte.length > 500 || String(chapitre).length > 40) throw erreur("refuse");
    const id = `q${now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    s.questions[id] = { texte, auteur: cle, pseudo, chapitre, creeLe: now(), reponse: "", aussi: [] };
    s.log.push({ op: "question", cle, id });
    return id;
  });
}

export function basculerAussi(id, on) {
  return call("basculerAussi", (s, cle) => {
    const q = s.questions[id];
    if (!isMember(s, cle) || !q) throw erreur("refuse");
    const list = q.aussi.filter((c) => c !== cle);
    if (on) list.push(cle);
    if (list.length > 60) throw erreur("refuse");
    q.aussi = list;
  });
}

export function repondre(id, texte) {
  return call("repondre", (s, cle) => {
    const q = s.questions[id];
    if (!s.admins.includes(cle) || !q || typeof texte !== "string" || texte.length > 2000) throw erreur("refuse");
    q.reponse = texte;
    q.reponduLe = now();
    s.log.push({ op: "reponse", cle, id });
  });
}

export function supprimerQuestion(id) {
  return call("supprimerQuestion", (s, cle) => {
    const q = s.questions[id];
    if (!q) return;
    if (!s.admins.includes(cle) && !(isMember(s, cle) && q.auteur === cle)) throw erreur("refuse");
    delete s.questions[id];
    s.log.push({ op: "supprimer-question", cle, id });
  });
}

export function estAdmin() {
  return call("estAdmin", (s, cle) => s.admins.includes(cle));
}

// For the tests (tests/test_compte.py): read the "server", move its clock.
window.fauxBackend = {
  serveur: () => read(),
  avancer: (ms) => { shift += ms; },
};
