/* =====================================================================================
   app.js: starts the app.

   1. Registers the offline mode (core/offline.js and sw.js).
   2. Loads the content: content/planning.json, content/themes.json,
      content/planning-themes.json and content/questions.json.
   3. Shows the screen written in the address (#planning by default) and keeps the
      header, the tab bar and the clock up to date.
   ===================================================================================== */

import { $, $$, icon, setHTML } from "./core/dom.js";
import { startRouter, go, readRoute } from "./core/router.js";
import { startOffline } from "./core/offline.js";
import { showToast } from "./core/toast.js";
import { longDate, capitalize, toISO } from "./core/dates.js";
import { footerHTML } from "./core/texts.js";
import { createPlanning } from "./planning/model.js";
import { mountPlanning } from "./planning/planning.js";
import { createReviserContent } from "./reviser/content.js";
import { renderReviser, refreshReviser } from "./reviser/reviser.js";
import { isPlaying } from "./reviser/player.js";
import { renderSoon } from "./screens/soon.js";
import { renderInfos } from "./screens/infos.js";

/** Shown in Infos. Change it when you publish a new version. */
export const APP_VERSION = "Phase 2 · 6 novembre 2026";

const TITLES = { reviser: "Réviser", etudier: "Étudier", planning: "Planning", infos: "Infos" };

const app = {
  route: null,          // screen shown now: { screen, param }
  themes: [],           // content/themes.json
  links: [],            // content/planning-themes.json
  model: null,          // the planning, ready to use (planning/model.js)
  planningText: "",     // raw text of planning.json, to notice when it changes
  planning: null,       // the Planning tab once built
  reviser: null,        // the questions of Réviser, ready to use (reviser/content.js)
  questionsText: "",    // raw text of questions.json, to notice when it changes
  scroll: {},           // where each screen was scrolled to
  day: toISO(new Date()),
  hiddenAt: 0,
};

// -------------------------------------------------------------------------------------
// Content
// -------------------------------------------------------------------------------------
async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.text();
}

/** The questions of Réviser. A broken file gives an empty Réviser, never a broken app. */
function useQuestions(text) {
  let list = [];
  try {
    list = JSON.parse(text);
  } catch (error) {
    console.error("content/questions.json n’est pas un JSON valide :", error);
  }
  app.questionsText = text;
  app.reviser = createReviserContent(app.themes, list);
}

async function loadContent() {
  const [themes, links, questionsText, planningText] = await Promise.all([
    fetchText("content/themes.json").then(JSON.parse).catch(() => []),
    fetchText("content/planning-themes.json").then(JSON.parse).catch(() => []),
    fetchText("content/questions.json").catch(() => "[]"),
    fetchText("content/planning.json").catch((error) => { console.error(error); return null; }),
  ]);
  app.themes = Array.isArray(themes) ? themes : [];
  app.links = Array.isArray(links) ? links : [];
  useQuestions(questionsText);
  // If the planning can't load, the Planning tab says so, and Réviser still works.
  if (planningText) {
    app.planningText = planningText;
    app.model = createPlanning(JSON.parse(planningText), app.themes, app.links);
  }
}

/** Back on screen after a long time: is there a newer planning, or new questions? */
async function refreshContent() {
  try {
    const text = await fetchText("content/questions.json");
    if (text !== app.questionsText && !isPlaying()) {
      useQuestions(text);
      refreshReviser(app.reviser);
      showToast("Nouvelles questions disponibles");
    }
  } catch (error) {
    /* offline: keep what we have */
  }
  try {
    const text = await fetchText("content/planning.json");
    if (text === app.planningText) return;
    app.planningText = text;
    app.model = createPlanning(JSON.parse(text), app.themes, app.links);
    if (app.planning) app.planning.setModel(app.model);
    showToast("Planning mis à jour");
  } catch (error) {
    /* offline: keep what we have */
  }
}

// -------------------------------------------------------------------------------------
// Screens
// -------------------------------------------------------------------------------------
function updateHeader(screen) {
  $("#appbar-date").textContent = capitalize(longDate(new Date()));
  $("#appbar-title").textContent = TITLES[screen];
  $("#topbar-title").textContent = TITLES[screen];
  document.title = screen === "planning" ? "Promo MAPST" : `${TITLES[screen]} · Promo MAPST`;
}

function showScreen(route) {
  const previous = app.route;
  if (previous && previous.screen === route.screen && previous.param === route.param) return;
  if (previous) app.scroll[previous.screen] = window.scrollY;
  app.route = route;

  $$(".tab").forEach((tab) => {
    const active = tab.dataset.tab === route.screen;
    tab.setAttribute("aria-selected", String(active));
  });
  $$(".screen").forEach((section) => { section.hidden = section.dataset.screen !== route.screen; });

  const section = $(`#screen-${route.screen}`);
  renderScreen(route, section);
  updateHeader(route.screen);

  if (previous && previous.screen !== route.screen) {
    section.classList.remove("is-entering");
    void section.offsetWidth;          // restarts the animation
    section.classList.add("is-entering");
    window.scrollTo(0, app.scroll[route.screen] || 0);
  }
}

function renderScreen(route, section) {
  if (route.screen === "planning") {
    if (!app.model) setHTML(section, loadErrorHTML());
    else if (!app.planning) app.planning = mountPlanning(section, app.model, { onTheme: openTheme });
  } else if (route.screen === "reviser") {
    renderReviser(section, app.reviser || createReviserContent(app.themes, []), route.param);
  } else if (route.screen === "etudier") {
    renderSoon(section, "etudier", app.themes, route.param);
  } else {
    renderInfos(section, app.model, APP_VERSION);
  }
}

/** « Réviser ce thème » / « Étudier ce thème » from the details of a class. */
function openTheme(mode, themeId) {
  go(mode, themeId, { push: true });
  window.scrollTo(0, 0);
}

function loadErrorHTML() {
  return `<div class="wrap screen__body">
      <div class="card empty">${icon("alert")}
        <p><b>Le planning n’a pas pu se charger.</b></p>
        <p>Vérifie ta connexion internet, puis réessaie. Après une première visite, l’appli marche aussi sans internet.</p>
        <button type="button" class="btn btn--primary" onclick="location.reload()">Réessayer</button>
      </div>
      ${footerHTML()}
    </div>`;
}

// -------------------------------------------------------------------------------------
// Header, tab bar, clock
// -------------------------------------------------------------------------------------
function setupChrome() {
  // Tabs: tap a tab to open it; tap the open tab again to go back to the top.
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (app.route && app.route.screen === tab.dataset.tab && !app.route.param) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        go(tab.dataset.tab);
      }
    });
  });

  // ⓘ button: opens Infos (the back button returns to where you were).
  $("#btn-infos").addEventListener("click", () => {
    if (app.route && app.route.screen === "infos") history.back();
    else go("infos", null, { push: true });
  });

  // The small top bar appears once the big title has scrolled away.
  const topbar = $("#topbar");
  const observer = new IntersectionObserver(([entry]) => {
    topbar.classList.toggle("is-visible", !entry.isIntersecting);
  }, { rootMargin: "-56px 0px 0px 0px" });
  observer.observe($("#appbar-title"));
}

function tick() {
  const now = new Date();
  const day = toISO(now);
  if (day !== app.day) {
    app.day = day;
    if (app.route) updateHeader(app.route.screen);
  }
  if (app.planning) app.planning.tick(now);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    app.hiddenAt = Date.now();
    return;
  }
  tick();
  if (app.hiddenAt && Date.now() - app.hiddenAt > 30 * 60 * 1000) refreshContent();
});

// -------------------------------------------------------------------------------------
// Start
// -------------------------------------------------------------------------------------
async function boot() {
  // The app decides where each screen is scrolled (the browser would restore old positions
  // when a sheet closes with the back button).
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  startOffline();
  updateHeader(readRoute().screen);
  try {
    await loadContent();
  } catch (error) {
    console.error(error);
  }
  setupChrome();
  startRouter(showScreen);
  setInterval(tick, 30 * 1000);
}

boot();
