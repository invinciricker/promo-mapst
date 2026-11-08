/* =====================================================================================
   welcome.js: the welcome, on the first launch only (mockups 1 and 2).

     1. Bienvenue: the dawn scene full screen, « Promo MAPST », one sentence,
        « Commencer ». One short entrance: the title fades in and the sun rises a little
        (under a second; nothing for people who asked their phone for less motion).
     2. « On t'appelle comment ? »: a first name or a nickname (20 characters at most),
        saved on this phone only. « Continuer » or « Passer ».
        In Phase 4 this step becomes the account.
     3. Only when the app is open in a browser (not installed): how to install it,
        with « Plus tard ».
   Then Accueil. Phones that used the app before Phase 3 also see it once.
   « Back » (Android) goes back one step; the app stays on the welcome until the end.
   ===================================================================================== */

import { $, esc, icon, setHTML, isInstalled } from "../core/dom.js";
import { pauseNav } from "../core/nav.js";
import { NAME_MAX, firstName, setFirstName, setWelcomeDone } from "../core/user.js";
import { canPromptInstall, promptInstall, installStepsHTML } from "./install.js";

/** Shows the welcome over the app. onDone() is called when it is closed. */
export function showWelcome({ onDone = () => {} } = {}) {
  const withInstall = !isInstalled();
  const total = withInstall ? 2 : 1;           // steps after Bienvenue
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
      <div class="wl-fade" aria-hidden="true"></div>
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
        <div class="note">${icon("lock")}<span>Bientôt, un compte avec un code à 6 chiffres pour retrouver ta progression sur un autre téléphone.</span></div>
        <div class="wl-bottom"><button type="submit" class="btn btn--primary btn--block">Continuer</button></div>
      </form>
    </section>

    ${withInstall ? `<section class="wl-step wl-page" data-step="2" hidden>
      <div class="wl-head">
        <button type="button" class="icon-btn icon-btn--surface" data-prev aria-label="Retour">${icon("left")}</button>
        ${dots(2)}
        <span></span>
      </div>
      <div class="mini-sky mini-sky--icon" aria-hidden="true"><img src="icons/icon-192.png" alt=""></div>
      <h1 class="page-title">Installe l’appli</h1>
      <p class="muted wl-lead">Sur ton écran d’accueil, elle s’ouvre en un geste, même sans internet, et se met à jour toute seule.</p>
      <div class="wl-install-now"></div>
      <div class="steps-box">${installStepsHTML()}</div>
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

  function finish() {
    saveName();
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

  // « Back » of the phone: the step before.
  function onPop() {
    if (step > 0) show(step - 1, { history: false });
  }
  window.addEventListener("popstate", onPop);

  root.addEventListener("click", async (event) => {
    const t = event.target;
    if (t.closest("[data-next]")) {
      show(1);
      // In the same tap, so that the phone opens its keyboard.
      input.focus({ preventScroll: true });
    } else if (t.closest("[data-prev]")) {
      history.back();
    } else if (t.closest("[data-skip]")) {
      input.value = "";
      if (withInstall) show(2); else finish();
    } else if (t.closest("[data-done]")) {
      finish();
    } else if (t.closest("[data-install-now]")) {
      const installed = await promptInstall();
      if (installed) finish();
      else renderInstallButton();
    }
  });

  $(".wl-form", root).addEventListener("submit", (event) => {
    event.preventDefault();
    input.blur();
    saveName();
    if (withInstall) show(2); else finish();
  });

  // Android: the browser's own « Installer » window, when it is available.
  function renderInstallButton() {
    const box = $(".wl-install-now", root);
    if (!box) return;
    setHTML(box, canPromptInstall()
      ? `<button type="button" class="btn btn--primary btn--block" data-install-now>${icon("download")}Installer l’appli</button>`
      : "");
  }
  renderInstallButton();
  window.addEventListener("install-ready", renderInstallButton);

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
    svg.querySelectorAll('circle[fill="url(#aube-sun)"], circle[fill="url(#aube-glow)"]').forEach((c) => c.classList.add("wl-sun"));
  } catch (error) {
    box.innerHTML = `<img src="img/baie-aube.svg" alt="">`;     // no rising sun, but the picture
  }
  box.classList.add("is-ready");
}
