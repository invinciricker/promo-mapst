/* =====================================================================================
   compte.js (screens): the account sheets and the « Mon compte » card of Profil (Phase 6).

     openCompteSheet({ mode })   « Créer mon compte » (mode "creer") or « Me connecter »
                                 ("connecter"), one sheet that switches between the two.
                                 After signing in to an account made without the class
                                 code, the same sheet shows the « Code de la promo » field
                                 alone. Opened from the welcome, Profil, the classement
                                 and the questions. Address ?compte=creer / ?compte=connecter
     openCodeSheet()             « Changer mon code »         (?code)
     openLogoutSheet()           « Me déconnecter »           (?deconnexion)
     openDeleteSheet()           « Supprimer mon compte »     (?suppression)
     compteCardHTML(), handleCompteClick(), bindClassementSwitch()   the card of Profil
     avatarHTML(pseudo)          the round initial (the bay of the moment, and a letter)
     MESSAGES                    the sentence of each error code (js/compte/backend.js)

   The work itself (Firebase, the sync) is in js/compte/compte.js.
   ===================================================================================== */

import { $, esc, icon, setHTML } from "../core/dom.js";
import { registerModal } from "../core/nav.js";
import { openSheet } from "../core/sheet.js";
import { showToast } from "../core/toast.js";
import { initial } from "../core/user.js";
import { skyAt } from "../core/sun.js";
import { pseudoOk, codeOk, codeTropFacile, codePromoOk } from "../compte/regles.js";
import { comptesActifs, compte, creer, connecter, completer, abandonner, deconnecter, changerCode,
  supprimer, reglerClassement } from "../compte/compte.js";

export const MESSAGES = {
  "pseudo-pris": "Ce pseudo est déjà pris. Si c’est le tien, connecte-toi.",
  identifiants: "Pseudo ou code incorrect.",
  "trop-essais": "Trop d’essais. Réessaie dans quelques minutes.",
  "code-promo": "Ce code de la promo n’est pas bon. Demande-le à ton groupe.",
  "hors-ligne": "Pas de connexion. Réessaie quand tu as du réseau.",
  "non-connecte": "Connecte-toi d’abord.",
  refuse: "Ça n’a pas marché. Réessaie dans un moment.",
  inconnu: "Ça n’a pas marché. Réessaie dans un moment.",
};
const message = (error) => MESSAGES[error && error.code] || MESSAGES.inconnu;

const TEXT = {
  pseudo: "3 à 15 lettres, chiffres, - ou _",
  sixDigits: "Il faut 6 chiffres.",
  easy: "Trop facile à deviner. Choisis-en un autre.",
  different: "Les deux codes sont différents.",
  wrongCode: "Code incorrect.",
  card: "N’utilise pas le code de ta carte bancaire ni celui de ton téléphone.",
  stored: "Ton pseudo, ton code (illisible, même pour nous), ta progression, tes XP de la semaine si tu choisis le classement, et tes questions. Pas d’e-mail, pas de nom. C’est stocké en Europe, chez Google Firebase. Tu peux tout supprimer dans Profil.",
};

/** The round initial of a pseudo, on the bay of the moment (like Profil's). */
export function avatarHTML(pseudo, { big = false } = {}) {
  const sky = skyAt(new Date());
  return `<span class="avatar avatar--${sky}${big ? " avatar--big" : ""}" aria-hidden="true"><img src="img/baie-${sky}.svg" alt=""><b>${esc(initial(pseudo) || "?")}</b></span>`;
}

/** « il y a 2 min », « il y a 3 h », « il y a 2 j » (« à l’instant » under a minute). */
export function ilYa(ms, now = Date.now()) {
  const minutes = Math.floor(Math.max(0, now - ms) / 60000);
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

// -------------------------------------------------------------------------------------
// Pieces of the forms
// -------------------------------------------------------------------------------------
let fieldCount = 0;

/** A field: its label, the input, an optional hint, and the place of its error. */
function fieldHTML({ name, label, hint = "", attrs = "", secret = false }) {
  const id = `f-${name}-${++fieldCount}`;
  const input = secret
    ? `<span class="code-field"><input class="input input--big" id="${id}" name="${name}" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" ${attrs}>
        <button type="button" class="code-field__eye" data-eye aria-label="Afficher le code" aria-pressed="false">${icon("eye")}</button></span>`
    : `<input class="input input--big" id="${id}" name="${name}" ${attrs}>`;
  return `<div class="field" data-field="${name}">
      <label class="field__label" for="${id}">${esc(label)}</label>
      ${input}
      ${hint ? `<span class="field__hint">${esc(hint)}</span>` : ""}
      <span class="field__err" data-err="${name}" role="alert"></span>
    </div>`;
}

const PSEUDO_ATTRS = 'type="text" maxlength="15" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next"';
const PROMO_ATTRS = 'type="text" maxlength="20" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done"';

/** Errors: shown under their field; "general" above the main button. */
function showError(form, name, text) {
  const place = form.querySelector(`[data-err="${name}"]`) || form.querySelector('[data-err="general"]');
  if (!place) return;
  place.textContent = text;
  const field = place.closest(".field");
  if (field) field.classList.add("is-wrong");
}

function clearErrors(form) {
  form.querySelectorAll("[data-err]").forEach((e) => { e.textContent = ""; });
  form.querySelectorAll(".field.is-wrong").forEach((f) => f.classList.remove("is-wrong"));
}

function focusFirstError(form) {
  const wrong = form.querySelector(".field.is-wrong input, .field.is-wrong textarea");
  if (wrong) wrong.focus();
}

/** The main button says « Un instant… » while the work is done. */
function setBusy(form, on) {
  const button = form.querySelector('[type="submit"]');
  if (!button) return;
  if (on) { button.dataset.label = button.textContent; button.textContent = "Un instant…"; }
  else if (button.dataset.label) button.textContent = button.dataset.label;
  button.disabled = on;
  form.classList.toggle("is-busy", on);
}

/** The eye shows or hides a code; only digits can be typed in a code. */
function bindCodeFields(root) {
  root.addEventListener("click", (event) => {
    const eye = event.target.closest("[data-eye]");
    if (!eye) return;
    const input = eye.parentElement.querySelector("input");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    eye.setAttribute("aria-pressed", String(show));
    eye.setAttribute("aria-label", show ? "Cacher le code" : "Afficher le code");
    setHTML(eye, icon(show ? "eye-off" : "eye"));
  });
  root.addEventListener("input", (event) => {
    const input = event.target;
    if (input.matches && input.matches('input[inputmode="numeric"]')) {
      const clean = input.value.replace(/\D/g, "").slice(0, 6);
      if (clean !== input.value) input.value = clean;
    }
  });
}

const focusLater = (el) => {
  if (el && window.matchMedia("(pointer: fine)").matches) requestAnimationFrame(() => el.focus({ preventScroll: true }));
};

// -------------------------------------------------------------------------------------
// « Créer mon compte » / « Me connecter »
// -------------------------------------------------------------------------------------

/**
 * Opens the account sheet.
 *   mode         "creer" or "connecter"
 *   overWelcome  true from the welcome: no address (the welcome handles « back »)
 *   onDone()     called after the account is created or signed in (the sheet is closed)
 */
export function openCompteSheet({ mode = "creer", overWelcome = false, onDone = null } = {}) {
  let pendingPromo = null;          // signed in without a profile: the pseudo, until the class code is given
  const sheet = openSheet({
    title: mode === "connecter" ? "Me connecter" : "Créer mon compte",
    className: "compte-sheet",
    address: overWelcome ? null : ["compte", mode],
    onClose: () => { if (pendingPromo) abandonner(); },
  });
  const title = $(".sheet__title", sheet.el);

  function render(which, extra = {}) {
    mode = which;
    if (which === "creer") {
      title.textContent = "Créer mon compte";
      setHTML(sheet.body, `<form class="compte-form" novalidate data-mode="creer">
          ${fieldHTML({ name: "pseudo", label: "Pseudo", hint: "Pas ton nom complet. 3 à 15 lettres ou chiffres.", attrs: PSEUDO_ATTRS })}
          ${fieldHTML({ name: "code", label: "Code à 6 chiffres", secret: true, attrs: 'autocomplete="new-password" enterkeyhint="next"' })}
          ${fieldHTML({ name: "code2", label: "Encore une fois", secret: true, attrs: 'autocomplete="new-password" enterkeyhint="next"' })}
          <p class="compte-form__warn">${icon("lock", "icon--s")}<span>${esc(TEXT.card)}</span></p>
          ${fieldHTML({ name: "promo", label: "Code de la promo", hint: "Celui donné dans le groupe de la promo.", attrs: PROMO_ATTRS })}
          <div class="compte-form__switch">
            <label class="switch-row"><span>Apparaître dans le classement</span>
              <span class="switch"><input type="checkbox" role="switch" name="classement"><span class="switch__track"></span></span></label>
            <span class="field__hint">Les autres voient ton pseudo et tes XP de la semaine.</span>
          </div>
          <details class="compte-form__more"><summary>Ce qui est enregistré${icon("right", "icon--xs")}</summary><p>${esc(TEXT.stored)}</p></details>
          <p class="form-msg" data-err="general" role="alert"></p>
          <div class="sheet__actions">
            <button type="submit" class="btn btn--primary btn--block">Créer mon compte</button>
            <button type="button" class="btn btn--plain btn--block compte-form__switch-mode" data-to="connecter">J’ai déjà un compte</button>
          </div>
        </form>`);
      focusLater(sheet.body.querySelector('[name="pseudo"]'));
    } else if (which === "connecter") {
      title.textContent = "Me connecter";
      setHTML(sheet.body, `<form class="compte-form" novalidate data-mode="connecter">
          ${fieldHTML({ name: "pseudo", label: "Pseudo", attrs: PSEUDO_ATTRS })}
          ${fieldHTML({ name: "code", label: "Code à 6 chiffres", secret: true, attrs: 'autocomplete="current-password" enterkeyhint="go"' })}
          <p class="form-msg" data-err="general" role="alert"></p>
          <div class="sheet__actions">
            <button type="submit" class="btn btn--primary btn--block">Me connecter</button>
            <button type="button" class="btn btn--plain btn--block compte-form__switch-mode" data-to="creer">Créer un compte</button>
          </div>
          <p class="compte-form__small">Code oublié ? Demande à l’admin de la promo : il peut t’en redonner un.</p>
        </form>`);
      focusLater(sheet.body.querySelector('[name="pseudo"]'));
    } else {
      // Signed in, but the account was made without the class code.
      title.textContent = "Code de la promo";
      setHTML(sheet.body, `<form class="compte-form" novalidate data-mode="promo">
          <p class="sheet-text">Il manque le code de la promo pour finir ton compte, ${esc(extra.pseudo)}.</p>
          ${fieldHTML({ name: "promo", label: "Code de la promo", hint: "Celui donné dans le groupe de la promo.", attrs: PROMO_ATTRS })}
          <p class="form-msg" data-err="general" role="alert"></p>
          <div class="sheet__actions"><button type="submit" class="btn btn--primary btn--block">Continuer</button></div>
        </form>`);
      focusLater(sheet.body.querySelector('[name="promo"]'));
    }
  }

  async function done(text) {
    pendingPromo = null;
    await sheet.close();
    showToast(text);
    if (onDone) onDone();
  }

  async function submit(form) {
    clearErrors(form);
    const value = (name) => (form.elements.namedItem(name) ? form.elements.namedItem(name).value : "");
    const pseudo = value("pseudo").trim();
    const code = value("code");
    let bad = false;
    const wrong = (name, text) => { showError(form, name, text); bad = true; };

    if (mode === "creer") {
      const promo = value("promo").trim();
      if (!pseudoOk(pseudo)) wrong("pseudo", TEXT.pseudo);
      if (!codeOk(code)) wrong("code", TEXT.sixDigits);
      else if (codeTropFacile(code)) wrong("code", TEXT.easy);
      else if (value("code2") !== code) wrong("code2", TEXT.different);
      if (!codePromoOk(promo)) wrong("promo", MESSAGES["code-promo"]);
      if (bad) return focusFirstError(form);
      setBusy(form, true);
      try {
        await creer({ pseudo, code, codePromo: promo, classement: form.elements.namedItem("classement").checked });
        await done("Compte créé. Ta progression est sauvegardée.");
      } catch (error) {
        if (error.code === "pseudo-pris") showError(form, "pseudo", message(error));
        else if (error.code === "code-promo") showError(form, "promo", message(error));
        else showError(form, "general", message(error));
        focusFirstError(form);
      } finally {
        if (form.isConnected) setBusy(form, false);
      }
    } else if (mode === "connecter") {
      if (!pseudoOk(pseudo)) wrong("pseudo", TEXT.pseudo);
      if (!codeOk(code)) wrong("code", TEXT.sixDigits);
      if (bad) return focusFirstError(form);
      setBusy(form, true);
      try {
        const result = await connecter({ pseudo, code });
        if (result.besoinCodePromo) {
          pendingPromo = pseudo;
          render("promo", { pseudo });
          return;
        }
        await done(`Content de te revoir, ${result.pseudo}.`);
      } catch (error) {
        if (error.code === "identifiants") showError(form, "code", message(error));
        else showError(form, "general", message(error));
      } finally {
        if (form.isConnected) setBusy(form, false);
      }
    } else {
      const promo = value("promo").trim();
      if (!codePromoOk(promo)) { wrong("promo", MESSAGES["code-promo"]); return focusFirstError(form); }
      setBusy(form, true);
      try {
        const result = await completer({ pseudo: pendingPromo, codePromo: promo });
        await done(`Content de te revoir, ${result.pseudo}.`);
      } catch (error) {
        showError(form, error.code === "code-promo" ? "promo" : "general", message(error));
      } finally {
        if (form.isConnected) setBusy(form, false);
      }
    }
  }

  sheet.body.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!event.target.classList.contains("is-busy")) submit(event.target);
  });
  sheet.body.addEventListener("click", (event) => {
    const to = event.target.closest("[data-to]");
    if (to) render(to.dataset.to);
  });
  bindCodeFields(sheet.body);
  render(mode);
  return sheet;
}

// -------------------------------------------------------------------------------------
// « Changer mon code », « Me déconnecter », « Supprimer mon compte »
// -------------------------------------------------------------------------------------
export function openCodeSheet() {
  const sheet = openSheet({
    title: "Changer mon code",
    className: "compte-sheet",
    address: "code",
    body: `<form class="compte-form" novalidate>
        ${fieldHTML({ name: "ancien", label: "Ton code actuel", secret: true, attrs: 'autocomplete="current-password" enterkeyhint="next"' })}
        ${fieldHTML({ name: "code", label: "Nouveau code à 6 chiffres", secret: true, attrs: 'autocomplete="new-password" enterkeyhint="next"' })}
        ${fieldHTML({ name: "code2", label: "Encore une fois", secret: true, attrs: 'autocomplete="new-password" enterkeyhint="done"' })}
        <p class="compte-form__warn">${icon("lock", "icon--s")}<span>${esc(TEXT.card)}</span></p>
        <p class="form-msg" data-err="general" role="alert"></p>
        <div class="sheet__actions"><button type="submit" class="btn btn--primary btn--block">Changer mon code</button></div>
      </form>`,
  });
  const form = $("form", sheet.body);
  bindCodeFields(form);
  focusLater(form.elements.namedItem("ancien"));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.classList.contains("is-busy")) return;
    clearErrors(form);
    const ancien = form.elements.namedItem("ancien").value;
    const code = form.elements.namedItem("code").value;
    let bad = false;
    if (!codeOk(ancien)) { showError(form, "ancien", TEXT.sixDigits); bad = true; }
    if (!codeOk(code)) { showError(form, "code", TEXT.sixDigits); bad = true; }
    else if (codeTropFacile(code)) { showError(form, "code", TEXT.easy); bad = true; }
    else if (form.elements.namedItem("code2").value !== code) { showError(form, "code2", TEXT.different); bad = true; }
    if (bad) return focusFirstError(form);
    setBusy(form, true);
    try {
      await changerCode({ ancien, nouveau: code });
      await sheet.close();
      showToast("Code changé.");
    } catch (error) {
      if (error.code === "identifiants") showError(form, "ancien", TEXT.wrongCode);
      else showError(form, "general", message(error));
    } finally {
      if (form.isConnected) setBusy(form, false);
    }
  });
  return sheet;
}

export function openLogoutSheet({ onDone = null } = {}) {
  const sheet = openSheet({
    title: "Me déconnecter ?",
    address: "deconnexion",
    body: `<p class="sheet-text">Ta progression reste sur ce téléphone.</p>
      <div class="sheet__actions">
        <button type="button" class="btn btn--primary btn--block" data-logout>Me déconnecter</button>
        <button type="button" class="btn btn--block" data-sheet-cancel>Annuler</button>
      </div>`,
  });
  sheet.body.addEventListener("click", async (event) => {
    if (event.target.closest("[data-sheet-cancel]")) { sheet.close(); return; }
    const button = event.target.closest("[data-logout]");
    if (!button || button.disabled) return;
    button.disabled = true;
    button.textContent = "Un instant…";
    await deconnecter();
    await sheet.close();
    showToast("À bientôt !");
    if (onDone) onDone();
  });
  return sheet;
}

export function openDeleteSheet({ onDone = null } = {}) {
  const sheet = openSheet({
    title: "Supprimer ton compte ?",
    className: "compte-sheet",
    address: "suppression",
    body: `<form class="compte-form" novalidate>
        <p class="sheet-text">Ton pseudo, ta progression en ligne, ta place au classement et tes questions seront effacés. Ta progression reste sur ce téléphone.</p>
        ${fieldHTML({ name: "code", label: "Ton code à 6 chiffres", secret: true, attrs: 'autocomplete="current-password" enterkeyhint="done"' })}
        <p class="form-msg" data-err="general" role="alert"></p>
        <div class="sheet__actions"><button type="submit" class="btn btn--block btn--delete">Supprimer définitivement</button></div>
      </form>`,
  });
  const form = $("form", sheet.body);
  bindCodeFields(form);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.classList.contains("is-busy")) return;
    clearErrors(form);
    const code = form.elements.namedItem("code").value;
    if (!codeOk(code)) { showError(form, "code", TEXT.sixDigits); return focusFirstError(form); }
    setBusy(form, true);
    try {
      await supprimer({ code });
      await sheet.close();
      showToast("Compte supprimé.");
      if (onDone) onDone();
    } catch (error) {
      if (error.code === "identifiants") showError(form, "code", TEXT.wrongCode);
      else showError(form, "general", message(error));
    } finally {
      if (form.isConnected) setBusy(form, false);
    }
  });
  return sheet;
}

// The sheets have their own address (the app can open on them, « back » closes them).
registerModal("compte", (value) => {
  if (!comptesActifs() || compte()) return false;
  openCompteSheet({ mode: value === "connecter" ? "connecter" : "creer" });
  return true;
});
registerModal("code", () => (compte() ? (openCodeSheet(), true) : false));
registerModal("deconnexion", () => (compte() ? (openLogoutSheet(), true) : false));
registerModal("suppression", () => (compte() ? (openDeleteSheet(), true) : false));

// -------------------------------------------------------------------------------------
// « Mon compte » in Profil
// -------------------------------------------------------------------------------------

/** « Sauvegardé il y a 2 min » or « Pas encore sauvegardé ». */
export function savedLine(c = compte()) {
  return c && c.sync ? `Sauvegardé ${ilYa(c.sync)}` : "Pas encore sauvegardé";
}

/** The card « Mon compte » (empty when accounts are switched off). */
export function compteCardHTML() {
  if (!comptesActifs()) return "";
  const c = compte();
  const classementRow = `<button type="button" class="row tap tone-soleil" data-classement>
      <span class="tile-icon">${icon("award", "icon--s")}</span>
      <span class="row__main row__title">Classement de la semaine</span>${icon("right", "chev")}</button>`;
  if (!c) {
    return `<h2 class="group-title group-title--first">Mon compte</h2>
      <div class="card compte-card">
        <div class="compte-card__top"><span class="tile-icon tile-icon--m tone-turquoise">${icon("person", "icon--s")}</span>
          <p class="compte-card__text">Sauvegarde ta progression et rejoins le classement.</p></div>
        <div class="compte-card__btns">
          <button type="button" class="btn btn--primary btn--block" data-compte="creer">Créer mon compte</button>
          <button type="button" class="btn btn--block compte-card__ghost" data-compte="connecter">J’ai déjà un compte</button>
        </div>
      </div>
      <div class="list compte-after">${classementRow}</div>`;
  }
  return `<h2 class="group-title group-title--first">Mon compte</h2>
    <div class="list compte-list">
      <div class="row compte-me">${avatarHTML(c.pseudo)}
        <span class="row__main"><span class="row__title">${esc(c.pseudo)}</span><span class="row__sub" data-saved>${esc(savedLine(c))}</span></span></div>
      <label class="row row--top tone-soleil">
        <span class="tile-icon">${icon("award", "icon--s")}</span>
        <span class="row__main"><span class="row__title">Apparaître dans le classement</span>
          <span class="row__sub">Les autres voient ton pseudo et tes XP de la semaine.</span></span>
        <span class="switch"><input type="checkbox" role="switch" data-classement-switch aria-label="Apparaître dans le classement"${c.classement ? " checked" : ""}><span class="switch__track"></span></span>
      </label>
      ${classementRow}
      <button type="button" class="row tap tone-galet" data-code>
        <span class="tile-icon">${icon("key", "icon--s")}</span><span class="row__main row__title">Changer mon code</span>${icon("right", "chev")}</button>
      <button type="button" class="row tap tone-galet" data-logout>
        <span class="tile-icon">${icon("logout", "icon--s")}</span><span class="row__main row__title">Me déconnecter</span></button>
      <button type="button" class="row tap tone-bougainvillier compte-delete" data-delete>
        <span class="tile-icon">${icon("trash", "icon--s")}</span><span class="row__main row__title">Supprimer mon compte</span></button>
    </div>`;
}

/** The taps on the card. Returns true when the tap was for it. */
export function handleCompteClick(event, { onClassement }) {
  const t = event.target;
  const open = t.closest("[data-compte]");
  if (open) { openCompteSheet({ mode: open.dataset.compte }); return true; }
  if (t.closest("[data-classement]")) { onClassement(); return true; }
  if (t.closest("[data-code]")) { openCodeSheet(); return true; }
  if (t.closest("[data-logout]")) { openLogoutSheet(); return true; }
  if (t.closest("[data-delete]")) { openDeleteSheet(); return true; }
  return false;
}

/** « Apparaître dans le classement »: on or off online; back as it was if it fails. */
export async function switchClassement(input) {
  const on = input.checked;
  input.disabled = true;
  try {
    await reglerClassement(on);
    showToast(on ? "Tu apparais dans le classement." : "Tu n’apparais plus dans le classement.");
  } catch (error) {
    input.checked = !on;
    showToast(message(error));
  } finally {
    input.disabled = false;
  }
}
