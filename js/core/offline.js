/* =====================================================================================
   offline.js: makes the app work without internet, and keeps it up to date.

   It registers sw.js (the "service worker"), a small program the browser keeps on the
   phone. sw.js stores a copy of the app and of the content. Each time the app opens, it
   checks quietly if a newer version was published. When there is one:
     - the new content (planning...) is used straight away;
     - for new code, a message offers to reload, and the app reloads by itself the next
       time it comes back to the screen.
   ===================================================================================== */

import { showToast } from "./toast.js";

let updateReady = false;
let hiddenSince = 0;

export function startOffline() {
  if (!("serviceWorker" in navigator)) return;
  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.register("sw.js").catch(() => {
    /* No offline mode (for example in a private window): the app still works online. */
  });

  // Messages from sw.js
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "update-ready") onUpdateReady();
  });

  // A new sw.js took over: the app files changed.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) onUpdateReady();
  });

  // When the app comes back on screen after a while: apply a waiting update, or check.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenSince = Date.now();
      return;
    }
    if (updateReady) {
      location.reload();
    } else if (hiddenSince && Date.now() - hiddenSince > 30 * 60 * 1000) {
      checkForUpdates();
    }
  });
}

/** Asks sw.js to look for a newer version now. */
export function checkForUpdates() {
  const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
  if (sw) sw.postMessage({ type: "check-updates" });
  if (navigator.serviceWorker) {
    navigator.serviceWorker.getRegistration().then((reg) => reg && reg.update()).catch(() => {});
  }
}

function onUpdateReady() {
  if (updateReady) return;
  updateReady = true;
  // Opened less than 5 seconds ago: reload now, nobody is reading yet.
  if (performance.now() < 5000) {
    location.reload();
    return;
  }
  showToast("Une nouvelle version de l’appli est prête.", {
    action: "Recharger",
    onAction: () => location.reload(),
    duration: 0,
  });
}
