/* =====================================================================================
   welcome.js: the welcome, on the first launch only (mockups 1 and 2).

     1. Bienvenue: the dawn scene full screen, « Promo MAPST », one sentence,
        « Commencer ». One short entrance: the title fades in and the sun rises a little
        (under a second; nothing for people who asked their phone for less motion).
     2. « On t'appelle comment ? »: a first name or a nickname (20 characters at most),
        saved on this phone only. « Continuer » or « Passer ».
     3. Since Phase 6, when accounts are on and nobody is signed in: « Garde ta
        progression », with « Créer mon compte » and « J'ai déjà un compte » (the account
        sheet, js/screens/compte.js, opens over the welcome) or « Plus tard ».
     4. Only when the app is open in a browser (not installed): how to install it (the
        same help as the « Installer l'appli » sheet, js/screens/install.js), with
        « Plus tard ».
   Like the rest of the app it draws under the clock of the iPhone: the first step has the
   sky and a soft shade, the next ones a small amber bar.
   Then Accueil. Phones that used the app before Phase 3 also see it once.
   « Back » (Android) goes back one step; the app stays on the welcome until the end.
   ===================================================================================== */

import { $, esc, icon, setHTML, isInstalled } from "../core/dom.js";
import { pauseNav } from "../core/nav.js";
import { hasOpenSheet, closeSheet } from "../core/sheet.js";
import { comptesActifs, compte } from "../compte/compte.js";
import { openCompteSheet } from "./compte.js";
import { NAME_MAX, firstName, setFirstName, setWelcomeDone } from "../core/user.js";
import { installHelpHTML, bindInstallHelp } from "./install.js";

/** Shows the welcome over the app. onDone() is called when it is closed. */
export function showWelcome({ onDone = () => {} } = {}) {
  const withInstall = !isInstalled();
  const withAccount = comptesActifs() && !compte();
  const total = 1 + (withAccount ? 1 : 0) + (withInstall ? 1 : 0);   // steps after Bienvenue
  const root = document.createElement("div");
  root.className = "welcome";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Bienvenue dans Promo MAPST");

  const dots = (n) => total > 1
    ? `<span class="wl-steps" aria-label="Étape ${n} sur ${total}">${Array.from({ length: total }, (_, i) => `<i${i < n ? ' class="on"' : ""}></i>`).join("")}</span>`
    : "<span></span>";

  setHTML(root, `
    <section class="wl-step wl-intro is-on" data-step="0">
      <div class="wl-scene" aria-hidden="true"></div>
      <div class="wl-shade" aria-hidden="true"></div>
      <div class="wl-brand">
        <h1 class="wl-title">Promo MAPST</h1>
        <p class="wl-sub">Des leçons de 5 minutes sur tes cours, et le planning de la promo toujours sur toi.</p>
      </div>
      <div class="wl-cta">
        <button type="button" class="btn btn--primary btn--block" data-next>Commencer</button>
        <p class="wl-note">Appli non officielle, faite par un stagiaire.</p>
      </div>
    </section>

    <section class="wl-step wl-page" data-step="1" hidden>
      <div class="wl-head">
        <button type="button" class="icon-btn icon-btn--surface" data-prev aria-label="Retour">${icon("left")}</button>
        ${dots(1)}
        <button type="button" class="wl-skip" data-skip>Passer</button>
      </div>
      <div class="mini-sky" aria-hidden="true"><img src="img/baie-aube.svg" alt=""></div>
      <h1 class="page-title">On t’appelle comment ?</h1>
      <p class="muted wl-lead">Ton prénom ou un surnom, pour te dire bonjour. Il reste sur ce téléphone.</p>
      <form class="wl-form" novalidate>
        <input class="input input--big wl-name" name="prenom" type="text" maxlength="${NAME_MAX}" value="${esc(firstName())}"
          autocomplete="given-name" autocapitalize="words" enterkeyhint="next" placeholder="Ton prénom" aria-label="Ton prénom ou un surnom">
        <div class="wl-bottom"><button type="submit" class="btn btn--primary btn--block">Continuer</button></div>
      </form>
    </section>

    ${withAccount ? `<section class="wl-step wl-page" data-step="compte" hidden>
      <div class="wl-head">
        <button type="button" class="icon-btn icon-btn--surface" data-prev aria-label="Retour">${icon("left")}</button>
        ${dots(2)}
        <span></span>
      </div>
      <div class="mini-sky mini-sky--account" aria-hidden="true"><img src="img/baie-aube.svg" alt="">${icon("award")}</div>
      <h1 class="page-title">Garde ta progression</h1>
      <p class="muted wl-lead">Avec un compte, tu retrouves tes XP sur un nouveau téléphone et tu peux poser tes questions à la promo.</p>
      <div class="wl-bottom wl-account">
        <button type="button" class="btn btn--primary btn--block" data-account="creer">Créer mon compte</button>
        <button type="button" class="btn btn--block wl-glass" data-account="connecter">J’ai déjà un compte</button>
        <button type="button" class="wl-later" data-later>Plus tard</button>
      </div>
    </section>` : ""}

    ${withInstall ? `<section class="wl-step wl-page" data-step="installer" hidden>
      <div class="wl-head">
        <button type="button" class="icon-btn icon-btn--surface" data-prev aria-label="Retour">${icon("left")}</button>
        ${dots(total)}
        <span></span>
      </div>
      <div class="mini-sky mini-sky--icon" aria-hidden="true"><img src="icons/icon-192.png" alt=""></div>
      <h1 class="page-title">Installe l’appli</h1>
      <p class="muted wl-lead">Sur ton écran d’accueil, elle s’ouvre en un geste, même sans internet, et se met à jour toute seule.</p>
      <div class="wl-install"></div>
      <div class="wl-bottom"><button type="button" class="btn btn--block" data-done>Plus tard</button></div>
    </section>` : ""}`);

  document.getElementById("layers").appendChild(root);
  document.documentElement.classList.add("has-welcome");
  const app = document.getElementById("app");
  if (app) app.inert = true;
  pauseNav(true);

  const steps = [...root.querySelectorAll(".wl-step")];
  const input = $(".wl-name", root);
  let step = 0;

  // The dawn scene, drawn in the page (not as a picture) so that its sun can rise.
  drawScene($(".wl-scene", root));

  /** Shows another step, sliding from the right (forward) or the left (back). */
  function show(next, { history: writeHistory = true } = {}) {
    if (next === step) return;
    const forward = next > step;
    const from = steps[step];
    const to = steps[next];
    to.hidden = false;
    to.classList.remove("anim-from-right", "anim-from-left");
    void to.offsetWidth;
    to.classList.add(forward ? "anim-from-right" : "anim-from-left");
    from.hidden = true;
    step = next;
    if (writeHistory && forward) history.pushState({ welcome: next }, "", location.hash);
    const focus = to.querySelector(".page-title");
    if (focus) { focus.tabIndex = -1; focus.focus({ preventScroll: true }); }
  }

  function saveName() {
    setFirstName(input.value);
  }

  /** The next step, or the end of the welcome. */
  function next() {
    if (step + 1 < steps.length) show(step + 1);
    else finish();
  }

  function finish() {
    setWelcomeDone(true);
    // Remove the welcome's own steps from the history, then give « back » to the app.
    const extra = step;
    const end = () => {
      pauseNav(false);
      document.documentElement.classList.remove("has-welcome");
      if (app) app.inert = false;
      root.classList.add("is-leaving");
      setTimeout(() => root.remove(), 380);
      onDone();
    };
    if (extra > 0) {
      const once = () => { window.removeEventListener("popstate", once); clearTimeout(timer); end(); };
      const timer = setTimeout(once, 600);
      window.addEventListener("popstate", once);
      history.go(-extra);
    } else {
      end();
    }
    window.removeEventListener("popstate", onPop);
  }

  // « Back » of the phone: the step before (or, with the account sheet open, it closes).
  function onPop() {
    if (hasOpenSheet()) {
      closeSheet();
      history.pushState({ welcome: step }, "", location.hash);
      return;
    }
    if (step > 0) show(step - 1, { history: false });
  }
  window.addEventListener("popstate", onPop);

  root.addEventListener("click", (event) => {
    const t = event.target;
    if (t.closest("[data-next]")) {
      show(1);
      // In the same tap, so that the phone opens its keyboard.
      input.focus({ preventScroll: true });
    } else if (t.closest("[data-prev]")) {
      history.back();
    } else if (t.closest("[data-skip]")) {
      // « Passer »: nothing is saved (a name saved before stays as it is).
      input.blur();
      next();
    } else if (t.closest("[data-account]")) {
      // The account sheet, over the welcome; once done, the next step.
      openCompteSheet({ mode: t.closest("[data-account]").dataset.account, overWelcome: true, onDone: next });
    } else if (t.closest("[data-later]")) {
      next();
    } else if (t.closest("[data-done]")) {
      finish();
    }
  });

  $(".wl-form", root).addEventListener("submit", (event) => {
    event.preventDefault();
    input.blur();
    saveName();
    next();
  });

  // The help to install, for this phone. On Android the browser's own « Installer »
  // window may only become available a moment later: the help is then drawn again.
  const installBox = $(".wl-install", root);
  if (installBox) {
    const renderInstall = () => { if (installBox.isConnected) setHTML(installBox, installHelpHTML()); };
    renderInstall();
    bindInstallHelp(installBox, { onInstalled: () => finish() });
    window.addEventListener("install-ready", renderInstall);
  }

  requestAnimationFrame(() => root.classList.add("is-open"));
}

/** Puts the dawn picture in the page, and gives its sun the class that makes it rise. */
async function drawScene(box) {
  try {
    const response = await fetch("img/baie-aube.svg");
    if (!response.ok) throw new Error(response.status);
    box.innerHTML = await response.text();
    const svg = box.querySelector("svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMax slice");   // anchored at the bottom
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("aria-hidden", "true");
    svg.querySelectorAll(".b-sun, .b-glow").forEach((c) => c.classList.add("wl-sun"));
  } catch (error) {
    box.innerHTML = `<img src="img/baie-aube.svg" alt="">`;     // no rising sun, but the picture
  }
  box.classList.add("is-ready");
}
