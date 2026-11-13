/* =====================================================================================
   sw.js: the "service worker", a small program the browser keeps on the phone.

   What it does:
   1. The first time the app is opened, it saves a copy of every file listed below.
      After that, the app opens even without internet.
   2. Each time the app is opened, it checks quietly (in the background) whether the
      files changed on GitHub Pages. If they did, it saves the new ones and tells the
      app, which offers to reload (see js/core/offline.js).
   3. The content (content/...) is always fetched fresh when there is internet, so new
      questions or a new planning show up straight away. Each content file is saved when
      it is fetched; without internet, the saved copy is used. So a NEW content file
      (a study page...) needs no change here: it works offline once it has been opened.
   4. The lessons of Cours (content/lecons/, Phase 5) are content too: at installation
      their list (content/lecons/index.json) is read and every lesson saved, and the app
      fetches them all in the background at each start (js/cours/lecons.js), pictures
      included. So a new lesson works offline without being listed anywhere.

   IMPORTANT: when you add a file to the app itself (a new .js or .css...), add it to
   APP_FILES below, otherwise it won't work offline. scripts/check_offline_list.py checks it.
   ===================================================================================== */

// Change this name only to force every phone to throw away its copy and start fresh.
const CACHE = "promo-mapst-v3";

// The files of the app itself.
const APP_FILES = [
  "index.html",
  "manifest.webmanifest",
  "css/01-tokens.css",
  "css/02-base.css",
  "css/03-components.css",
  "css/04-layout.css",
  "css/05-planning.css",
  "css/06-screens.css",
  "css/07-reviser.css",
  "css/08-accueil.css",
  "css/09-cours.css",
  "css/10-lecons.css",
  "js/app.js",
  "js/core/data.js",
  "js/core/dates.js",
  "js/core/dom.js",
  "js/core/nav.js",
  "js/core/offline.js",
  "js/core/sheet.js",
  "js/core/statusbar.js",
  "js/core/storage.js",
  "js/core/sun.js",
  "js/core/texts.js",
  "js/core/toast.js",
  "js/core/user.js",
  "js/cours/content.js",
  "js/cours/cours.js",
  "js/cours/lecon.js",
  "js/cours/lecons.js",
  "js/cours/markdown.js",
  "js/planning/dates-cles.js",
  "js/planning/details.js",
  "js/planning/event-form.js",
  "js/planning/export.js",
  "js/planning/model.js",
  "js/planning/parts.js",
  "js/planning/personal.js",
  "js/planning/planning.js",
  "js/planning/today.js",
  "js/planning/view-month.js",
  "js/planning/view-week.js",
  "js/planning/view-year.js",
  "js/reviser/answer.js",
  "js/reviser/confetti.js",
  "js/reviser/content.js",
  "js/reviser/player.js",
  "js/reviser/progress.js",
  "js/reviser/relecture.js",
  "js/reviser/reviser.js",
  "js/reviser/sound.js",
  "js/reviser/verdict.js",
  "js/screens/accueil.js",
  "js/screens/install.js",
  "js/screens/profil.js",
  "js/screens/relecture.js",
  "js/screens/welcome.js",
  "img/baie-aube.svg",
  "img/baie-jour.svg",
  "img/baie-couchant.svg",
  "img/baie-nuit.svg",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png",
  "vendor/fonts/plus-jakarta-sans.woff2",
];

// The main content, saved at installation so the app works offline straight away.
// Any other file of content/ is saved the first time it is fetched (no need to list it).
const CONTENT_FILES = [
  "content/planning.json",
  "content/planning.ics",
  "content/themes.json",
  "content/planning-themes.json",
  "content/questions.json",
  "content/parcours.json",
  "content/documents.json",
  "content/mots.json",
  "content/savais-tu.json",
];

const NETWORK_TIMEOUT = 4000;   // after 4 seconds without answer, use the saved copy
let lastCheck = 0;

// ---- 1. Installation: save a copy of everything ----------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // "reload": take the files from GitHub Pages, not from an old copy of the browser
    await cache.addAll(APP_FILES.map((url) => new Request(url, { cache: "reload" })));
    // The content one by one: a missing or renamed content file must not stop the app.
    await Promise.all(CONTENT_FILES.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => null)));
    await saveLessons(cache).catch(() => null);
    await self.skipWaiting();     // the new version starts straight away
  })());
});

// ---- Clean up the copies of older versions -------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE && key.startsWith("promo-mapst-")) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

// ---- Every request of the app goes through here ----------------------------------------
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;          // other websites: not our business
  const path = url.pathname.slice(new URL(self.registration.scope).pathname.length);

  // Opening the app (its address, or index.html): the saved copy, then check for updates.
  if (request.mode === "navigate" && (path === "" || path === "index.html")) {
    event.respondWith(fromCache("index.html", request));
    event.waitUntil(checkForUpdates());
    return;
  }
  // Content, and any other page (the .ics file opened in Safari...): internet first.
  if (path.startsWith("content/") || request.mode === "navigate") {
    const network = fetchAndSave(request, path);
    event.waitUntil(network.catch(() => null));
    event.respondWith(networkFirst(request, network));
    return;
  }
  // The files of the app: the saved copy (fast, works offline).
  event.respondWith(fromCache(path, request));
});

// The app asks for a check (when it comes back on screen after a while).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "check-updates") event.waitUntil(checkForUpdates(true));
});

// ---------------------------------------------------------------------------------------
/** The lessons of Cours: their list, then each lesson's text (read from the list, not written here). */
async function saveLessons(cache) {
  const response = await fetch("content/lecons/index.json", { cache: "reload" });
  if (!response.ok) return;
  await cache.put("content/lecons/index.json", response.clone());
  const index = await response.json();
  const ids = (index && Array.isArray(index.lecons) ? index.lecons : [])
    .map((lesson) => lesson && lesson.id)
    .filter((id) => typeof id === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id));
  await Promise.all(ids.map((id) => cache.add(new Request(`content/lecons/${id}.md`, { cache: "reload" })).catch(() => null)));
}

async function fromCache(key, request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(key, { ignoreSearch: true });
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") cache.put(key, response.clone());
  return response;
}

function fetchAndSave(request, path) {
  const fresh = request.mode === "navigate" ? fetch(request) : fetch(request, { cache: "no-cache" });
  return fresh.then(async (response) => {
    if (response.ok && response.type === "basic" && path.startsWith("content/")) {
      const cache = await caches.open(CACHE);
      await cache.put(path, response.clone());
    }
    return response;
  });
}

async function networkFirst(request, network) {
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT, null));
  try {
    const response = await Promise.race([network, timeout]);
    if (response) return response;
  } catch (error) {
    /* no internet: use the saved copy below */
  }
  const cache = await caches.open(CACHE);
  const saved = await cache.match(new URL(request.url).pathname.slice(new URL(self.registration.scope).pathname.length), { ignoreSearch: true });
  return saved || network;      // nothing saved: wait for the network after all
}

/** Downloads every app file again; if one changed, saves them all and tells the app. */
async function checkForUpdates(force = false) {
  if (!force && Date.now() - lastCheck < 5 * 60 * 1000) return;   // at most every 5 minutes
  lastCheck = Date.now();
  try {
    const cache = await caches.open(CACHE);
    const fresh = await Promise.all(APP_FILES.map(async (url) => {
      const response = await fetch(url, { cache: "no-cache" });
      if (!response.ok) throw new Error(url);
      return [url, response];
    }));
    let changed = false;
    for (const [url, response] of fresh) {
      const saved = await cache.match(url);
      if (!saved || !sameBytes(await saved.arrayBuffer(), await response.clone().arrayBuffer())) changed = true;
    }
    if (!changed) return;
    await Promise.all(fresh.map(([url, response]) => cache.put(url, response)));
    const windows = await self.clients.matchAll({ type: "window" });
    windows.forEach((client) => client.postMessage({ type: "update-ready" }));
  } catch (error) {
    /* offline or GitHub Pages busy: try again next time */
  }
}

function sameBytes(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}
