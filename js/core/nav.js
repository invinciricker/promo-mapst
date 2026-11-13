/* =====================================================================================
   nav.js: getting around the app (it replaces router.js since Phase 3).

   The app has 4 tabs: Accueil, Cours, Réviser, Planning.
   Each tab is a pile of pages: its first page, and the pages opened from it, which
   slide in from the right with « ‹ Previous screen » at the top left:

       Accueil  ›  Profil  ›  Rapport de relecture
       Cours    ›  Un chapitre, Tous les documents
       Réviser  ›  Un thème
       Planning ›  Dates clés

   Changing tab (Phase 4): the new tab comes from the side of its place in the bar (from
   the right when it is further right), the « lens » of the tab bar slides under its icon,
   and the phone gives a tiny tick when it can. The look is in css/04-layout.css.

   Sheets (details of a half-day...) and the lesson screen open OVER a page: they are
   "modals" (js/core/sheet.js, js/reviser/player.js).

   Every page and every modal has its own address, written after « # »:
       #accueil                  #accueil/profil            #reviser/anatomie-mouvement
       #planning?seance=2026-11-09-am      (a sheet over the Planning page)
       #accueil?ciel=nuit        (an option of the page: here, a forced sky)
   so the back button of Android, of the browser, and the « ‹ » buttons all work.

   How the browser history is kept (you don't need this to add a page):
     - the first step is always #accueil;
     - in another tab, the next step is that tab's first page (#reviser...);
     - then one step per page opened, and one per modal.
   So « back » closes a modal, then goes back page by page, then to Accueil, then leaves
   the app. Changing tab rewinds the history to #accueil and writes the new tab's pages
   (each tab remembers where you were). Each step stores its "level" (0 = #accueil).

   app.js gives nav.js one function, pageFor(path, element), that draws a page and
   returns { title, onShow, onActive, refresh, destroy } (or null if the address is
   unknown). onActive(true / false) tells a page when it becomes, or stops being, the
   page on screen (Accueil only moves its picture while it is).
   ===================================================================================== */

import { isIOS, isInstalled } from "./dom.js";
import { paintStatusBar } from "./statusbar.js";

export const TABS = ["accueil", "cours", "reviser", "planning"];   // in the order of the tab bar
export const HOME = "accueil";

/** Old addresses that still work (links saved before Phase 3). */
const ALIASES = [
  [/^infos\/relecture/, "accueil/profil/relecture"],
  [/^infos/, "accueil/profil"],
  [/^etudier.*/, "cours"],            // the study pages will live in Cours (Phase 6)
];

const SWIPE_EDGE = 28;                 // a swipe that starts this close to the left edge goes back
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const nav = {
  started: false,
  pageFor: null,          // from app.js
  onChange: () => {},     // called after every change of page or tab
  tab: null,              // tab shown now
  stacks: {},             // tab -> [{ path, url, page }]  (page: { el, title, onShow, refresh, destroy })
  modals: [],             // open modals, bottom to top: { key, value, url, level, close, beforePop }
  level: 0,               // the level of the current step of the history
  openers: {},            // modal key -> function(value) that opens it from an address
  openerList: {},         // modal key -> [{ tab, opener }] (see registerModal)
  unwinding: null,        // set while rewinding the history (tab change)
  skipAnimation: false,   // the swipe already moved the page: don't animate it again
  busy: false,
  shown: null,            // the entry (page) on screen now
  paused: false,          // the welcome screen handles « back » by itself
};

// -------------------------------------------------------------------------------------
// Addresses
// -------------------------------------------------------------------------------------

/** "#reviser/anatomie-mouvement?lecon=anatomie-mouvement-1" -> { tab, path, chain, query } */
export function parse(hash = location.hash) {
  let raw = decodeURIComponent(String(hash).replace(/^#\/?/, ""));
  const cut = raw.indexOf("?");
  const queryText = cut >= 0 ? raw.slice(cut + 1) : "";
  raw = (cut >= 0 ? raw.slice(0, cut) : raw).replace(/\/+$/, "");
  for (const [pattern, to] of ALIASES) {
    if (pattern.test(raw)) { raw = raw.replace(pattern, to); break; }
  }
  const parts = raw.split("/").filter(Boolean);
  if (!TABS.includes(parts[0])) parts.splice(0, parts.length, HOME);
  const chain = parts.map((_, i) => parts.slice(0, i + 1).join("/"));
  return { tab: parts[0], path: chain[chain.length - 1], chain, query: new URLSearchParams(queryText) };
}

/** The address of a page, with its options: "#accueil?ciel=nuit". */
function pageURL(path, query) {
  const text = query && query.toString();
  return "#" + path + (text ? "?" + text : "");
}

/** The options of the page shown now (for example ciel=nuit on Accueil). */
export function currentQuery() {
  const top = topEntry();
  if (!top) return new URLSearchParams();
  const cut = top.url.indexOf("?");
  return new URLSearchParams(cut >= 0 ? top.url.slice(cut + 1) : "");
}

const stack = (tab = nav.tab) => (nav.stacks[tab] = nav.stacks[tab] || []);
const topEntry = (tab = nav.tab) => { const s = stack(tab); return s[s.length - 1] || null; };
const baseLevel = (tab) => (tab === HOME ? 0 : 1);
const write = (how, level, url, extra = {}) => history[how]({ promo: 1, level, ...extra }, "", url);

// -------------------------------------------------------------------------------------
// Pages
// -------------------------------------------------------------------------------------
function panelOf(tab) {
  return document.querySelector(`.panel[data-tab="${tab}"]`);
}

/** Draws the page of an address in a new .page element; null if the address is unknown. */
function makePage(tab, path, url) {
  const el = document.createElement("div");
  el.className = "page";
  el.dataset.path = path;
  el.tabIndex = -1;
  const cut = url.indexOf("?");
  const query = new URLSearchParams(cut >= 0 ? url.slice(cut + 1) : "");
  const page = nav.pageFor(path, el, { pushed: path !== tab, query });
  if (!page) return null;
  page.el = el;
  panelOf(tab).appendChild(el);
  watchScroll(el);
  return { path, url, page };
}

function destroyEntry(entry) {
  if (!entry) return;
  if (entry.page.destroy) entry.page.destroy();
  entry.page.el.remove();
}

/**
 * The small coloured bar of a tab's first page appears once its big header has scrolled
 * away; the bar of a page opened from a tab shows the page's title once it is scrolled.
 */
function watchScroll(el) {
  let ticking = false;
  el.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const bar = el.querySelector(".topbar");
      if (!bar) return;
      if (bar.classList.contains("topbar--page")) bar.classList.toggle("is-stuck", el.scrollTop > 40);
      else bar.classList.toggle("is-on", el.scrollTop > 64);
    });
  }, { passive: true });
}

/** Shows only the top page of the tab (the others stay in place, hidden). */
function settle(tab = nav.tab) {
  const s = stack(tab);
  s.forEach((entry, i) => {
    const el = entry.page.el;
    const top = i === s.length - 1;
    if (!top && !el.hidden) entry.scroll = el.scrollTop;
    el.hidden = !top;
    el.style.transform = "";
    el.classList.remove("is-moving");
    el.inert = !top;
    if (top && entry.scroll != null) { el.scrollTop = entry.scroll; entry.scroll = null; }
  });
  document.querySelectorAll(".page__veil").forEach((v) => v.remove());
}

/**
 * Shows the panel of a tab and moves the « lens » of the tab bar under its icon.
 * With animate, the new panel comes from the side of its tab (classes is-entering and
 * is-leaving, and --dir: 1 from the right, -1 from the left; css/04-layout.css).
 */
function showTab(tab, { animate = false } = {}) {
  const before = nav.tab;
  const move = animate && before && before !== tab && !reduceMotion();
  const dir = TABS.indexOf(tab) > TABS.indexOf(before) ? 1 : -1;
  nav.tab = tab;
  document.querySelectorAll(".panel").forEach((panel) => {
    const on = panel.dataset.tab === tab;
    const leaving = move && panel.dataset.tab === before;
    if (!on && !panel.hidden) {
      const top = topEntry(panel.dataset.tab);
      if (top) top.scroll = top.page.el.scrollTop;
    }
    clearTimeout(panel.moveTimer);
    panel.classList.remove("is-entering", "is-leaving");
    panel.classList.toggle("is-on", on);
    panel.style.setProperty("--dir", dir);
    if (leaving) {
      // It stays on screen for the time of its short exit, then goes.
      panel.classList.add("is-leaving");
      panel.moveTimer = setTimeout(() => { panel.classList.remove("is-leaving"); panel.hidden = true; }, 170);
    } else {
      panel.hidden = !on;
      if (on && move) {
        panel.classList.add("is-entering");
        panel.moveTimer = setTimeout(() => panel.classList.remove("is-entering"), 900);
      }
    }
  });
  document.querySelectorAll(".tab[data-tab]").forEach((button) => {
    const on = button.dataset.tab === tab;
    button.setAttribute("aria-selected", String(on));
    button.classList.toggle("is-on", on);
  });
  const bar = document.querySelector(".tabbar");
  if (bar) bar.style.setProperty("--at", TABS.indexOf(tab));
  settle(tab);
}

/** Called each time the visible page changes. */
function changed({ fresh = false } = {}) {
  const top = topEntry();
  if (!top) return;
  document.title = top.page.title ? `${top.page.title} · Promo MAPST` : "Promo MAPST";
  // Where we are, for the styles (the tab bar at night) and the colour of the status bar.
  const app = document.getElementById("app");
  if (app) {
    app.dataset.tab = nav.tab;
    if (top.path === HOME) app.dataset.home = ""; else delete app.dataset.home;
  }
  paintStatusBar();
  if (nav.shown !== top) {
    if (nav.shown && nav.shown.page.onActive) nav.shown.page.onActive(false);
    nav.shown = top;
    if (top.page.onActive) top.page.onActive(true);
  }
  if (top.page.onShow && !fresh) top.page.onShow();
  nav.onChange(top.path);
}

// -------------------------------------------------------------------------------------
// Animations (pages slide like on an iPhone)
// -------------------------------------------------------------------------------------
const DURATION = 420;
const EASING = "cubic-bezier(.32, .72, 0, 1)";

function veil(under) {
  const v = document.createElement("div");
  v.className = "page__veil";
  under.page.el.appendChild(v);
  return v;
}

/** The page `top` slides in from the right over `under` (or out, when `out` is true). */
function slide(top, under, { out = false, from = null } = {}) {
  if (reduceMotion() || !under) return Promise.resolve();
  const width = top.page.el.offsetWidth || window.innerWidth;
  const start = from == null ? (out ? 0 : width) : from;
  const end = out ? width : 0;
  const share = (x) => x / width;                 // 0 = page fully in, 1 = fully out
  under.page.el.hidden = false;
  top.page.el.hidden = false;
  top.page.el.classList.add("is-moving");
  const v = veil(under);
  const options = { duration: DURATION * Math.max(.35, Math.abs(end - start) / width), easing: EASING, fill: "forwards" };
  const animations = [
    top.page.el.animate([{ transform: `translateX(${start}px)` }, { transform: `translateX(${end}px)` }], options),
    under.page.el.animate([{ transform: `translateX(${-30 * (1 - share(start))}%)` }, { transform: `translateX(${-30 * (1 - share(end))}%)` }], options),
    v.animate([{ opacity: 1 - share(start) }, { opacity: 1 - share(end) }], options),
  ];
  return Promise.all(animations.map((a) => a.finished.catch(() => null))).then(() => {
    animations.forEach((a) => a.cancel());
  });
}

// -------------------------------------------------------------------------------------
// Moving around
// -------------------------------------------------------------------------------------

/** Opens a page in the current tab: it slides in from the right. */
export async function push(path, { animate = true } = {}) {
  if (nav.busy) return;
  const target = parse("#" + path);
  if (target.tab !== nav.tab) return switchTab(target.tab, { push: path });
  nav.busy = true;
  try {
    await closeAllModals();
    const entry = makePage(nav.tab, target.path, pageURL(target.path, target.query));
    if (!entry) return;
    const under = topEntry();
    stack().push(entry);
    nav.level += 1;
    write("pushState", nav.level, entry.url);
    entry.page.el.hidden = false;
    changed({ fresh: true });
    if (animate) await slide(entry, under);
    settle();
    entry.page.el.focus({ preventScroll: true });
  } finally {
    nav.busy = false;
  }
}

/** « ‹ Back »: the same as the back button of the phone. */
export function back() {
  if (nav.busy) return;
  if (nav.level > 0) history.back();
}

/** Shows a tab, where it was left. With { push: path }, shows that page of the tab. */
export async function switchTab(tab, { push: path = null } = {}) {
  if (!TABS.includes(tab) || nav.busy) return;
  if (tab === nav.tab && !path) return toRoot();
  nav.busy = true;
  await closeAllModals();
  await rewind(nav.level);                     // back to the first step: #accueil
  if (tab !== nav.tab && navigator.vibrate) {
    try { navigator.vibrate(8); } catch (error) { /* not important */ }   // a tiny tick (Android)
  }
  showTab(tab, { animate: true });
  const s = stack(tab);
  if (!s.length) {
    const root = makePage(tab, tab, "#" + tab);
    if (root) s.push(root);
  }
  if (path) while (s.length > 1) destroyEntry(s.pop());   // « Réviser ce thème »: from the top of the tab
  // Write the tab's pages in the history again.
  if (tab === HOME) write("replaceState", 0, s[0].url);
  else write("pushState", 1, s[0].url);
  nav.level = baseLevel(tab);
  for (const entry of s.slice(1)) write("pushState", ++nav.level, entry.url);
  settle(tab);
  changed();
  nav.busy = false;
  if (path && path !== tab) await push(path);
}

/** Tapping the current tab again: back to its first page. */
async function toRoot() {
  const s = stack();
  if (s.length <= 1 && !nav.modals.length) {
    const el = s[0] && s[0].page.el;
    if (el) el.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
    return;
  }
  nav.busy = true;
  await closeAllModals();
  const steps = nav.level - baseLevel(nav.tab);
  await rewind(steps);
  const top = s[s.length - 1];
  const root = s[0];
  if (top !== root) await slide(top, root, { out: true });
  while (s.length > 1) destroyEntry(s.pop());
  settle();
  changed();
  nav.busy = false;
}

/** Goes back `steps` steps in the history without drawing anything in between. */
function rewind(steps) {
  if (steps <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      nav.unwinding = null;
      nav.level = Math.max(0, nav.level - steps);
      resolve();
    };
    const timer = setTimeout(done, 700);     // in case the browser never answers
    nav.unwinding = done;
    history.go(-steps);
  });
}

// -------------------------------------------------------------------------------------
// The back button of the phone or of the browser (and history.back() above)
// -------------------------------------------------------------------------------------
window.addEventListener("popstate", async (event) => {
  if (!nav.started || nav.paused) return;
  if (nav.unwinding) { nav.unwinding(); return; }
  const state = event.state && event.state.promo ? event.state : null;
  const level = state ? state.level : null;
  const target = parse();

  // 1. Modals above the new step close (top first). One may refuse: « Mes erreurs »
  //    asks before stopping. Its step is then written again, and it asks (onRefuse).
  while (nav.modals.length && (level === null || nav.modals[nav.modals.length - 1].level > level)) {
    const modal = nav.modals[nav.modals.length - 1];
    if (modal.beforePop && modal.beforePop() === false) {
      write("pushState", modal.level, modal.url, { modal: modal.key });
      nav.level = modal.level;
      if (modal.onRefuse) modal.onRefuse();
      return;
    }
    nav.modals.pop();
    modal.close();
  }
  const modalParam = nav.modals.length ? null : [...target.query].find(([key]) => key in nav.openers);
  if (modalParam && state) {
    // A modal in the address that isn't open (the browser's « forward »): just the page.
    const plain = new URLSearchParams([...target.query].filter(([key]) => !(key in nav.openers)));
    history.replaceState(history.state, "", pageURL(target.path, plain));
  }

  // 2. Pages.
  const s = stack();
  const index = target.tab === nav.tab ? s.findIndex((entry) => entry.path === target.path) : -1;
  if (index >= 0 && index < s.length - 1) {
    // Back to a page of this tab (usually the previous one): the top page slides away.
    const top = s[s.length - 1];
    const under = s[index];
    const animate = !nav.skipAnimation;
    nav.skipAnimation = false;
    nav.busy = true;
    if (animate) await slide(top, under, { out: true });
    while (s.length > index + 1) destroyEntry(s.pop());
    nav.busy = false;
    settle();
    changed();
  } else if (index === s.length - 1 && index >= 0) {
    // Same page (a modal closed). Its options may have changed (#accueil?ciel=nuit typed).
    const top = s[index];
    const plain = new URLSearchParams([...target.query].filter(([key]) => !(key in nav.openers)));
    const url = pageURL(top.path, plain);
    if (!nav.modals.length && url !== top.url) {
      top.url = url;
      if (top.page.onQuery) top.page.onQuery(plain);
    }
    settle();
  } else if (target.tab === HOME && target.path === HOME && nav.tab !== HOME) {
    // Back from the first page of another tab: Accueil, at its first page.
    const home = stack(HOME);
    while (home.length > 1) destroyEntry(home.pop());
    showTab(HOME, { animate: true });
    if (!home.length) { const root = makePage(HOME, HOME, location.hash || "#accueil"); if (root) home.push(root); settle(); }
    changed();
  } else {
    rebuild(target);
  }
  if (state) {
    nav.level = level;
  } else {
    // An address typed by hand (or a link): our step numbers start again from it, and an
    // old address (#infos) becomes the new one (#accueil/profil).
    nav.level = levelOf(target);
    const top = topEntry();
    write("replaceState", nav.level, top ? top.url : "#" + target.path);
    // A typed address of a sheet (#planning?seance=…): the sheet opens over its page.
    if (modalParam) nav.openers[modalParam[0]](modalParam[1]);
  }
});

/** The level an address would have in our history. */
function levelOf(target) {
  return baseLevel(target.tab) + target.chain.length - 1;
}

/** Shows any address, without animation (first opening, or an unexpected jump). */
function rebuild(target) {
  showTab(target.tab);
  const s = stack(target.tab);
  // Keep the pages that are already right, replace the others.
  let keep = 0;
  while (keep < s.length && keep < target.chain.length && s[keep].path === target.chain[keep]) keep++;
  while (s.length > keep) destroyEntry(s.pop());
  for (let i = keep; i < target.chain.length; i++) {
    const path = target.chain[i];
    const last = i === target.chain.length - 1;
    const plain = new URLSearchParams([...target.query].filter(([key]) => !(key in nav.openers)));
    const entry = makePage(target.tab, path, last ? pageURL(path, plain) : "#" + path);
    if (!entry) break;             // an unknown page (a theme that no longer exists...): stop here
    s.push(entry);
  }
  if (!s.length) {
    const root = makePage(target.tab, target.tab, "#" + target.tab);
    if (root) s.push(root);
  }
  settle(target.tab);
  changed();
}

// -------------------------------------------------------------------------------------
// Modals: sheets and the lesson screen (they call these functions)
// -------------------------------------------------------------------------------------

/**
 * Registers how to open a modal from its address (when the app is opened on
 * #planning?seance=…, for example). opener(value) returns false if it can't.
 * With { tab }, the opener is only used in that tab: ?lecon=… is a lesson of cards in
 * Cours (js/cours/lecon.js) and a quiz lesson everywhere else (js/reviser/reviser.js).
 */
export function registerModal(key, opener, { tab = null } = {}) {
  (nav.openerList[key] = nav.openerList[key] || []).push({ tab, opener });
  nav.openers[key] = (value) => {
    const list = nav.openerList[key];
    const mine = list.find((o) => o.tab === nav.tab) || list.find((o) => !o.tab);
    return mine ? mine.opener(value) : false;
  };
}

/**
 * A modal opens: one more step in the history, with its address.
 *   key, value   the address: ?key=value
 *   close()      called when the modal must close (back button...)
 *   beforePop()  optional: return false to refuse closing; onRefuse() is then called
 * Returns a handle for closeModal() and replaceModal().
 */
export function openModal({ key, value = "", close, beforePop = null, onRefuse = null }) {
  const url = modalURL(nav.modals.length, key, value);
  const modal = { key, value, url, level: nav.level + 1, close, beforePop, onRefuse };
  nav.modals.push(modal);
  nav.level = modal.level;
  write("pushState", modal.level, url, { modal: key });
  return modal;
}

/** Address of a modal: the address under it (page or modal), plus ?key=value. */
function modalURL(index, key, value) {
  const below = index > 0 ? nav.modals[index - 1].url : (topEntry() ? topEntry().url : location.hash);
  const params = value === "" ? key : `${key}=${encodeURIComponent(value)}`;
  return below + (below.includes("?") ? "&" : "?") + params;
}

/** The modal wants to close (its × button...): through the history, like « back ». */
export function closeModal(modal) {
  const index = nav.modals.indexOf(modal);
  if (index < 0) return;
  if (index === nav.modals.length - 1 && history.state && history.state.level === modal.level) {
    history.back();                 // the popstate above closes it
  } else {
    nav.modals.splice(index, 1);
    modal.close();
  }
}

/** One modal leads to another (details -> edit form): the address changes, no new step. */
export function replaceModal(modal, { key, value = "" }) {
  const index = nav.modals.indexOf(modal);
  if (index < 0) return;
  modal.key = key;
  modal.value = value;
  modal.url = modalURL(index, key, value);
  if (history.state && history.state.level === modal.level) write("replaceState", modal.level, modal.url, { modal: key });
}

/** Removes a modal from the list without touching the history (it is closing by itself). */
export function forgetModal(modal) {
  const index = nav.modals.indexOf(modal);
  if (index >= 0) nav.modals.splice(index, 1);
}

/** Closes every modal at once (before changing tab or page). */
async function closeAllModals() {
  if (!nav.modals.length) return;
  const steps = nav.modals.length;
  const list = nav.modals.splice(0);
  list.reverse().forEach((modal) => modal.close());
  await rewind(steps);
}

export function hasModal() {
  return nav.modals.length > 0;
}

// -------------------------------------------------------------------------------------
// Swipe from the left edge of the screen: back (like on an iPhone)
// -------------------------------------------------------------------------------------
function enableEdgeSwipe() {
  // In Safari (not installed) and on Android, the phone has its own gesture for « back ».
  if (isIOS() && !isInstalled()) return;
  let drag = null;

  document.addEventListener("touchstart", (event) => {
    if (nav.busy || nav.modals.length || event.touches.length !== 1) return;
    const s = stack();
    if (s.length < 2) return;
    const touch = event.touches[0];
    const panel = panelOf(nav.tab);
    const left = panel.getBoundingClientRect().left;
    if (touch.clientX - left > SWIPE_EDGE) return;
    drag = { x0: touch.clientX, y0: touch.clientY, dx: 0, t0: Date.now(), decided: false, top: s[s.length - 1], under: s[s.length - 2], v: null };
  }, { passive: true });

  document.addEventListener("touchmove", (event) => {
    if (!drag) return;
    const touch = event.touches[0];
    const dx = touch.clientX - drag.x0;
    const dy = touch.clientY - drag.y0;
    if (!drag.decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx) || dx < 0) { drag = null; return; }    // a scroll, not a swipe
      drag.decided = true;
      drag.under.page.el.hidden = false;
      drag.top.page.el.classList.add("is-moving");
      drag.v = veil(drag.under);
    }
    if (event.cancelable) event.preventDefault();
    const width = drag.top.page.el.offsetWidth;
    drag.dx = Math.max(0, Math.min(width, dx));
    const share = drag.dx / width;
    drag.top.page.el.style.transform = `translateX(${drag.dx}px)`;
    drag.under.page.el.style.transform = `translateX(${-30 * (1 - share)}%)`;
    drag.v.style.opacity = String(1 - share);
  }, { passive: false });

  const end = async () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.decided) return;
    const width = d.top.page.el.offsetWidth;
    const speed = d.dx / Math.max(1, Date.now() - d.t0);
    const go = d.dx > width * 0.35 || (speed > 0.5 && d.dx > 40);
    d.top.page.el.style.transform = "";
    d.under.page.el.style.transform = "";
    if (d.v) d.v.remove();
    nav.busy = true;
    if (go) {
      await slide(d.top, d.under, { out: true, from: d.dx });
      nav.busy = false;
      nav.skipAnimation = true;
      history.back();
    } else {
      await slideBack(d.top, d.under, d.dx);
      nav.busy = false;
      settle();
    }
  };
  document.addEventListener("touchend", end);
  document.addEventListener("touchcancel", end);
}

/** The swipe was too short: the page goes back in place. */
function slideBack(top, under, from) {
  if (reduceMotion()) return Promise.resolve();
  const width = top.page.el.offsetWidth || window.innerWidth;
  const options = { duration: 260, easing: EASING, fill: "forwards" };
  const v = veil(under);
  const animations = [
    top.page.el.animate([{ transform: `translateX(${from}px)` }, { transform: "translateX(0)" }], options),
    under.page.el.animate([{ transform: `translateX(${-30 * (1 - from / width)}%)` }, { transform: "translateX(-30%)" }], options),
    v.animate([{ opacity: 1 - from / width }, { opacity: 1 }], options),
  ];
  return Promise.all(animations.map((a) => a.finished.catch(() => null))).then(() => animations.forEach((a) => a.cancel()));
}

// -------------------------------------------------------------------------------------
// Start, and helpers for the pages
// -------------------------------------------------------------------------------------

/**
 * Starts the navigation on the address of the page (#accueil by default).
 *   pageFor(path, element, { pushed })  draws a page (see the top of this file)
 *   onChange(path)                      called after each change
 */
export function startNav({ pageFor, onChange = () => {} }) {
  nav.pageFor = pageFor;
  nav.onChange = onChange;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  // Taps on the tabs and on every « ‹ » button.
  document.querySelectorAll(".tab[data-tab]").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-nav-back]")) { event.preventDefault(); back(); }
  });
  enableEdgeSwipe();

  // Write the history for the address we were opened on: #accueil first, then the rest.
  const target = parse();
  const modalParam = [...target.query].find(([key]) => key in nav.openers);
  rebuild(target);
  const s = stack(target.tab);
  write("replaceState", 0, target.tab === HOME ? s[0].url : "#accueil");
  nav.level = 0;
  if (target.tab !== HOME) write("pushState", ++nav.level, s[0].url);
  for (const entry of s.slice(1)) write("pushState", ++nav.level, entry.url);
  nav.started = true;
  changed({ fresh: true });

  // Opened on a modal's address: open it (or forget it if it no longer exists).
  if (modalParam && nav.openers[modalParam[0]](modalParam[1]) === false) {
    write("replaceState", nav.level, topEntry().url);
  }
}

/** While the welcome screen is open, it handles « back » itself (js/screens/welcome.js). */
export function pauseNav(on) {
  nav.paused = Boolean(on);
}

/** Where we are: { tab, path, page, query }. */
export function current() {
  const top = topEntry();
  return { tab: nav.tab, path: top ? top.path : nav.tab, page: top ? top.page : null, query: currentQuery() };
}

/** Draws every open page again (new content, a lesson finished...). */
export function refreshPages() {
  for (const tab of Object.keys(nav.stacks)) {
    for (const entry of nav.stacks[tab]) if (entry.page.refresh) entry.page.refresh();
  }
}

/** The page shown now changes its address options (Accueil's ?ciel=...). */
export function setPageQuery(query) {
  const top = topEntry();
  if (!top) return;
  top.url = pageURL(top.path, query);
  if (!nav.modals.length) write("replaceState", nav.level, top.url);
}

/**
 * HTML of the bar of a page opened from a tab: « ‹ Réviser » on the colour of its tab,
 * and the page's title once it is scrolled. Put it first in the page, before its
 * <div class="page__body">.
 */
export function navbarHTML(backLabel, title = "") {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return `<div class="topbar topbar--page">
      <button type="button" class="back tap" data-nav-back aria-label="Retour : ${esc(backLabel)}">
        <svg class="icon" aria-hidden="true"><use href="#i-left"/></svg><span>${esc(backLabel)}</span></button>
      <span class="topbar__title" aria-hidden="true">${esc(title)}</span>
    </div>`;
}
