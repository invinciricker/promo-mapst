/* =====================================================================================
   install.js: helps people add the app to their home screen.
   - Android (Chrome): the browser can show its own « Installer » window.
   - iPhone (Safari): there is no such window, so we explain the 3 taps.
   ===================================================================================== */

import { icon, isIOS, isAndroid, isInstalled } from "../core/dom.js";
import { load, save } from "../core/storage.js";
import { openSheet } from "../core/sheet.js";

let installPrompt = null;   // the Android window, kept for when the person taps « Installer »

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();          // we show our own button instead of the browser banner
  installPrompt = event;
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  save("install-hint-dismissed", true);
});

/** Should the small « Installe l'appli » card be shown? (phones only, not yet installed) */
export function shouldShowInstallHint() {
  return !isInstalled() && (isIOS() || isAndroid()) && !load("install-hint-dismissed", false);
}

export function dismissInstallHint() {
  save("install-hint-dismissed", true);
}

export function installHintHTML() {
  return `<div class="card install-card">
      <span class="install-card__icon">${icon("phone")}</span>
      <div class="install-card__body">
        <p class="install-card__title">Installe l’appli</p>
        <p class="install-card__text">Sur ton écran d’accueil, elle s’ouvre en un geste, même sans internet.</p>
        <button type="button" class="btn btn--primary btn--small" data-install>Comment faire ?</button>
      </div>
      <button type="button" class="icon-btn install-card__close" data-install-dismiss aria-label="Ne plus afficher">${icon("close")}</button>
    </div>`;
}

/** Steps for this phone (used in the sheet and in Infos). */
export function installStepsHTML() {
  const iphone = `<ol class="steps">
      <li><span>Ouvre ce lien dans Safari.</span></li>
      <li><span>Touche le bouton Partager ${icon("share", "icon--inline")} en bas de l’écran.</span></li>
      <li><span>Choisis « Sur l’écran d’accueil », puis « Ajouter ».</span></li>
    </ol>`;
  const android = `<ol class="steps">
      <li><span>Ouvre ce lien dans Chrome.</span></li>
      <li><span>Touche le menu ${icon("more", "icon--inline icon--dots")} en haut à droite.</span></li>
      <li><span>Choisis « Installer l’application » (ou « Ajouter à l’écran d’accueil »).</span></li>
    </ol>`;
  if (isIOS()) return `<p class="option__title">Sur iPhone</p>${iphone}`;
  if (isAndroid()) return `<p class="option__title">Sur Android</p>${android}`;
  return `<p class="option__title">Sur iPhone</p>${iphone}<p class="option__title">Sur Android</p>${android}`;
}

export function openInstallSheet() {
  const canPrompt = Boolean(installPrompt);
  const body = `
    <p class="option__text" style="font-size:15px">L’appli s’ajoute à ton écran d’accueil comme les autres. Elle marche aussi sans internet, et se met à jour toute seule.</p>
    ${canPrompt ? `<button type="button" class="btn btn--primary btn--block" data-install-now>${icon("download")}Installer maintenant</button>` : ""}
    <div class="option">${installStepsHTML()}</div>`;
  const sheet = openSheet({ title: "Installer Promo MAPST", body });
  sheet.body.addEventListener("click", async (event) => {
    if (!event.target.closest("[data-install-now]") || !installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    installPrompt = null;
    sheet.close();
  });
}
