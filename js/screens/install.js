/* =====================================================================================
   install.js: helps people add the app to their home screen.

   Apple gives websites no way to install themselves: on iPhone the person has to do it
   from Safari's menu. So the app guides them as well as it can:
     - iPhone, in Safari: three steps (« en haut » instead of « en bas » on iPad);
     - iPhone, in another browser (Chrome, Firefox, Edge): step 1 talks about « ton
       navigateur »;
     - inside another app's browser (Instagram, Snapchat, WhatsApp...): first « Ouvre ce
       lien dans Safari », with « Copier le lien »;
     - Android: when the browser offers its own « Installer » window, the buttons open it
       directly; otherwise one line says where to tap in Chrome.
   Used by the pill on Accueil, the last step of the welcome and Profil › Installer
   l'appli. Once installed (isInstalled()), none of this is shown.
   ===================================================================================== */

import { icon, isIOS, isAndroid, copyText } from "../core/dom.js";
import { openSheet } from "../core/sheet.js";
import { registerModal } from "../core/nav.js";
import { showToast } from "../core/toast.js";

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

/** Where the app is open: which phone, which browser. */
export function installContext() {
  const ua = navigator.userAgent || "";
  const ios = isIOS();
  return {
    ios,
    ipad: ios && !/iPhone|iPod/.test(ua),
    android: isAndroid(),
    // Chrome, Firefox or Edge on an iPhone
    otherBrowser: ios && /CriOS|FxiOS|EdgiOS/.test(ua),
    // the small browser inside another app: it can't install anything
    inApp: /Instagram|FBAN|FBAV|Snapchat|TikTok|Line\/|LinkedInApp|WhatsApp/.test(ua),
  };
}

const key = (name) => `<span class="kbd">${icon(name, "icon--s")}</span>`;

function iphoneSteps(c) {
  const first = c.otherBrowser && !c.inApp
    ? "Touche le bouton Partager de ton navigateur."
    : `Touche ${key("dots")} ou ${key("share")} ${c.ipad ? "en haut" : "en bas"} de Safari, puis « Partager ».`;
  return `<ol class="steps">
      <li><span>${first}</span></li>
      <li><span>Fais défiler et touche ${key("addbox")} « Sur l’écran d’accueil ».</span></li>
      <li><span>Touche « Ajouter ». L’appli arrive avec tes autres applis.</span></li>
    </ol>`;
}

const ANDROID_LINE = `Touche ${key("more")} en haut de Chrome, puis « Installer l’application ».`;

/**
 * The help for this phone, as HTML: one sentence, the steps, and a small hint.
 * `now` adds the button that opens the browser's own « Installer » window when there is one.
 */
export function installHelpHTML({ now = true } = {}) {
  const c = installContext();
  const device = c.ipad ? "iPad" : "iPhone";
  const nowButton = now && canPromptInstall()
    ? `<button type="button" class="btn btn--primary btn--block" data-install-now>${icon("download")}Installer maintenant</button>` : "";
  const inApp = c.inApp
    ? `<div class="install-first">
        <p><b>Ouvre ce lien dans ${c.android ? "Chrome" : "Safari"} pour installer l’appli.</b></p>
        <button type="button" class="btn btn--soft tone-azur btn--medium" data-copy-link>${icon("copy")}Copier le lien</button>
      </div>` : "";

  if (c.android) {
    return `${inApp}${nowButton}
      <p class="sheet-text">${inApp ? "Ensuite, dans Chrome :" : "Sur Android, c’est Chrome qui installe."}</p>
      <ol class="steps"><li><span>${ANDROID_LINE}</span></li></ol>`;
  }
  if (c.ios) {
    const lead = inApp ? "Ensuite, dans Safari, trois gestes :"
      : c.otherBrowser ? `Sur ${device}, trois gestes :`
        : `Sur ${device}, c’est Safari qui installe. Trois gestes :`;
    return `${inApp}
      <p class="sheet-text">${lead}</p>
      ${iphoneSteps(c)}
      ${inApp ? "" : `<p class="small faint">Tu ne vois pas ces boutons ? Tu es dans Instagram ou Snapchat : ouvre d’abord le lien dans Safari.</p>`}`;
  }
  // A computer: both, since the link is usually opened again on the phone.
  return `${nowButton}
    <p class="sheet-text">Ouvre ce lien sur ton téléphone. Sur iPhone, c’est Safari qui installe. Trois gestes :</p>
    ${iphoneSteps(c)}
    <p class="sheet-text">Sur Android :</p>
    <ol class="steps"><li><span>${ANDROID_LINE}</span></li></ol>`;
}

/**
 * Makes the buttons of the help work (« Copier le lien », « Installer maintenant »).
 * onInstalled() is called when the browser says the app was installed.
 */
export function bindInstallHelp(root, { onInstalled = () => {} } = {}) {
  root.addEventListener("click", async (event) => {
    if (event.target.closest("[data-copy-link]")) {
      const ok = await copyText(location.origin + location.pathname);
      showToast(ok ? "Lien copié : colle-le dans Safari ou Chrome" : "Copie impossible : copie l’adresse à la main");
    } else if (event.target.closest("[data-install-now]")) {
      if (await promptInstall()) onInstalled();
    }
  });
}

/** The sheet « Installer l'appli ». */
export function openInstallSheet() {
  const sheet = openSheet({
    title: "Installer l’appli",
    address: "installer",
    className: "install-sheet",
    body: `${installHelpHTML()}
      <button type="button" class="btn btn--primary btn--block" data-understood>J’ai compris</button>`,
  });
  bindInstallHelp(sheet.body, { onInstalled: () => sheet.close() });
  sheet.body.addEventListener("click", (event) => {
    if (event.target.closest("[data-understood]")) sheet.close();
  });
}

/**
 * « Installer l'appli » was tapped (Accueil, Profil): on Android, the browser's own
 * window when it offers one; everywhere else, the sheet with the steps.
 */
export async function requestInstall() {
  if (canPromptInstall()) await promptInstall();
  else openInstallSheet();
}

registerModal("installer", () => { openInstallSheet(); return true; });
