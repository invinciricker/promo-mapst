/* =====================================================================================
   router.js: which screen is shown.

   The screen is written after "#" in the address: #planning, #reviser, #etudier, #infos.
   Something can follow, for example #reviser/fiche-de-seance opens Réviser on a theme.
   ===================================================================================== */

export const SCREENS = ["reviser", "etudier", "planning", "infos"];
export const DEFAULT_SCREEN = "planning";

let onRouteChange = () => {};

/** Reads the address: { screen: "reviser", param: "fiche-de-seance" } */
export function readRoute() {
  const [screen, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, "")).split("/");
  return {
    screen: SCREENS.includes(screen) ? screen : DEFAULT_SCREEN,
    param: rest.join("/") || null,
  };
}

/** Starts listening; `callback(route)` is called now and every time the screen changes. */
export function startRouter(callback) {
  onRouteChange = callback;
  // "popstate" happens with the back and forward buttons.
  window.addEventListener("popstate", () => onRouteChange(readRoute()));
  onRouteChange(readRoute());
}

/**
 * Shows a screen.
 *   push: true adds a step to the history, so "back" returns to the previous screen
 *         (used for Infos); false replaces the current step (used for the tabs).
 */
export function go(screen, param = null, { push = false } = {}) {
  const hash = "#" + screen + (param ? "/" + encodeURIComponent(param) : "");
  if (location.hash !== hash) {
    if (push) history.pushState(null, "", hash);
    else history.replaceState(null, "", hash);
  }
  onRouteChange(readRoute());
}
