/* =====================================================================================
   statusbar.js: the colour of Android's status bar (the "theme-color" of index.html).

   It follows the top of the screen shown:
     - Accueil (its first page): the sky, #7E9EC4 aube, #3F86BD jour, #4A3A80 couchant,
       #0A1C30 nuit;
     - everywhere else: the top of the tab's gradient (--top-cours, --top-reviser,
       --top-planning, and --top-accueil for Profil and its pages; css/01-tokens.css),
       light or dark;
     - during a lesson: --top-reviser.
   On iPhone the app draws under the clock itself, so there is nothing to do there.
   js/core/nav.js writes where we are on <div class="app"> (data-tab, data-home),
   Accueil writes its sky (data-ciel); call paintStatusBar() after any of them changes.
   ===================================================================================== */

const SKY_TOPS = { aube: "#7E9EC4", jour: "#3F86BD", couchant: "#4A3A80", nuit: "#0A1C30" };

export function paintStatusBar() {
  const meta = document.querySelector('meta[name="theme-color"]');
  const app = document.getElementById("app");
  if (!meta || !app) return;
  const root = document.documentElement;
  let color;
  if (root.classList.contains("has-player")) color = token("--top-reviser");
  else if (app.dataset.tab === "accueil" && "home" in app.dataset) color = SKY_TOPS[app.dataset.ciel] || SKY_TOPS.jour;
  else color = token(`--top-${app.dataset.tab || "accueil"}`);
  if (color) meta.setAttribute("content", color);
}

/** The value of a colour token of css/01-tokens.css, for the mode (light or dark) of the phone. */
function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// The phone switches between light and dark: the tokens change, so the colour too.
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paintStatusBar);
