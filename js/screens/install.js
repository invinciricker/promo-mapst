/* =====================================================================================
   install.js: helps people add the app to their home screen.
   - Android (Chrome): the browser can show its own « Installer » window (the button).
   - iPhone (Safari): there is no such window, so we explain the 3 taps.
   Used by the welcome (its last step, in a browser only) and by Profil › Installer l'appli.
   ===================================================================================== */

import { icon, isIOS, isAndroid } from "../core/dom.js";
import { openSheet } from "../core/sheet.js";
import { registerModal } from "../core/nav.js";

let installPrompt = null;   // the Android window, kept for when the person taps « Installer »

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();          // we show our own button instead of the browser banner
  installPrompt = event;
  window.dispatchEvent(new CustomEvent("install-ready"));
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
});

/** Can the browser install the app with one tap (Android, Chrome on a laptop)? */
export function canPromptInstall() {
  return Boolean(installPrompt);
}

/** Opens the browser's « Installer » window. Returns true if the app was installed. */
export async function promptInstall() {
  if (!installPrompt) return false;
  const prompt = installPrompt;
  prompt.prompt();
  const choice = await prompt.userChoice.catch(() => null);
  installPrompt = null;
  return Boolean(choice && choice.outcome === "accepted");
}

/** The steps for this phone (iPhone, Android, or both on a computer). */
export function installStepsHTML() {
  const iphone = `<ol class="steps">
      <li><span>Ouvre ce lien dans Safari.</span></li>
      <li><span>Touche le bouton Partager ${icon("share", "icon--inline")} en bas de l’écran.</span></li>
      <li><span>Choisis « Sur l’écran d’accueil », puis « Ajouter ».</span></li>
    </ol>`;
  const android = `<ol class="steps">
      <li><span>Ouvre ce lien dans Chrome.</span></li>
      <li><span>Touche le menu ${icon("more", "icon--inline")} en haut à droite.</span></li>
      <li><span>Choisis « Installer l’application » (ou « Ajouter à l’écran d’accueil »).</span></li>
    </ol>`;
  if (isIOS()) return `<p class="steps__title">Sur iPhone</p>${iphone}`;
  if (isAndroid()) return `<p class="steps__title">Sur Android</p>${android}`;
  return `<p class="steps__title">Sur iPhone</p>${iphone}<p class="steps__title">Sur Android</p>${android}`;
}

/** The sheet « Installer l'appli » (Profil). */
export function openInstallSheet() {
  const body = `
    <p class="sheet-text">L’appli s’ajoute à ton écran d’accueil comme les autres. Elle marche aussi sans internet, et se met à jour toute seule.</p>
    ${canPromptInstall() ? `<button type="button" class="btn btn--primary btn--block" data-install-now>${icon("download")}Installer maintenant</button>` : ""}
    <div class="steps-box">${installStepsHTML()}</div>`;
  const sheet = openSheet({ title: "Installer l’appli", body, address: "installer" });
  sheet.body.addEventListener("click", async (event) => {
    if (!event.target.closest("[data-install-now]")) return;
    await promptInstall();
    sheet.close();
  });
}

registerModal("installer", () => { openInstallSheet(); return true; });
