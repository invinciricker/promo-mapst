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
import { isRelectureOn } from "./reviser/relecture.js";
import { renderSoon } from "./screens/soon.js";
import { renderInfos } from "./screens/infos.js";
import { renderRelecture } from "./screens/relecture.js";

/** Shown in Infos. Change it when you publish a new version. */
export const APP_VERSION = "Phase 2 · 6 novembre 2026";

const TITLES = { reviser: "Réviser", etudier: "Étudier", planning: "Planning", infos: "Infos" };
const isReport = (route) => Boolean(route) && route.screen === "infos" && route.param === "relecture";

const app = {
  route: null,          // screen shown now: { screen, param }
  previous: null,       // the screen shown before it
  themes: [],           // content/themes.json
  themesText: "",       // raw text of themes.json, to notice when it changes
  links: [],            // content/planning-themes.json
  model: null,          // the planning, ready to use (planning/model.js)
  planningText: "",     // raw text of planning.json, to notice when it changes
  planning: null,       // the Planning tab once built
  questions: [],        // content/questions.json, as written in the file
  questionsText: "",    // raw text of questions.json, to notice when it changes
  reviser: null,        // the questions of Réviser, ready to use (reviser/content.js)
  scroll: {},           // where each screen was scrolled to
  day: toISO(new Date()),
  hiddenAt: 0,
};

// -------------------------------------------------------------------------------------
// Content
// -------------------------------------------------------------------------------------
async function fetchText(path) {
  // "no-cache": always ask GitHub Pages if the file changed (sw.js keeps a copy for offline).
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.text();
}

/** Reads a JSON list; a broken file gives an empty list (and a message in the console). */
function parseList(text, name) {
  try {
    const value = JSON.parse(text);
    if (Array.isArray(value)) return value;
    console.error(`${name} : une liste [ … ] était attendue`);
  } catch (error) {
    console.error(`${name} n’est pas un JSON valide :`, error);
  }
  return [];
}

/**
 * Builds Réviser from the themes and the questions, for the mode chosen in Infos
 * (« Mode relecture » shows the questions not checked yet).
 * A broken file gives an empty Réviser, never a broken app.
 */
function buildReviser() {
  app.reviser = createReviserContent(app.themes, app.questions, { relecture: isRelectureOn() });
}

async function loadContent() {
  const [themesText, links, questionsText, planningText] = await Promise.all([
    fetchText("content/themes.json").catch(() => "[]"),
    fetchText("content/planning-themes.json").then(JSON.parse).catch(() => []),
    fetchText("content/questions.json").catch(() => "[]"),
    fetchText("content/planning.json").catch((error) => { console.error(error); return null; }),
  ]);
  app.themesText = themesText;
  app.themes = parseList(themesText, "content/themes.json");
  app.links = Array.isArray(links) ? links : [];
  app.questionsText = questionsText;
  app.questions = parseList(questionsText, "content/questions.json");
  buildReviser();
  // If the planning can't load, the Planning tab says so, and Réviser still works.
  if (planningText) {
    app.planningText = planningText;
    app.model = createPlanning(JSON.parse(planningText), app.themes, app.links);
  }
}

/** Back on screen after a long time: are there new questions or lesson titles, or a newer planning? */
async function refreshContent() {
  try {
    if (isPlaying()) throw new Error("a lesson is open: try again next time");
    const [themesText, questionsText] = await Promise.all([
      fetchText("content/themes.json"), fetchText("content/questions.json")]);
    if ((themesText !== app.themesText || questionsText !== app.questionsText) && !isPlaying()) {
      const before = new Set(app.reviser ? [...app.reviser.themes].flatMap((t) => t.lessons.flatMap((l) => l.questions.map((q) => q.id))) : []);
      app.themesText = themesText;
      app.themes = parseList(themesText, "content/themes.json");
      app.questionsText = questionsText;
      app.questions = parseList(questionsText, "content/questions.json");
      buildReviser();
      refreshReviser(app.reviser);
      const added = app.reviser.themes.some((t) => t.lessons.some((l) => l.questions.some((q) => !before.has(q.id))));
      if (added) showToast("Nouvelles questions disponibles");
    }
  } catch (error) {
    /* offline, or a lesson is open: keep what we have */
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
function updateHeader(route) {
  const title = isReport(route) ? "Relecture" : TITLES[route.screen];
  $("#appbar-date").textContent = capitalize(longDate(new Date()));
  $("#appbar-title").textContent = title;
  $("#topbar-title").textContent = title;
  document.title = route.screen === "planning" ? "Promo MAPST" : `${title} · Promo MAPST`;
}

/** "reviser/fiche-de-seance": each page remembers where it was scrolled to. */
const pageKey = (route) => route.screen + (route.param ? `/${route.param}` : "");

function showScreen(route) {
  const previous = app.route;
  if (previous && pageKey(previous) === pageKey(route)) return;
  if (previous) app.scroll[pageKey(previous)] = window.scrollY;
  app.previous = previous;
  app.route = route;

  $$(".tab").forEach((tab) => {
    const active = tab.dataset.tab === route.screen;
    tab.setAttribute("aria-selected", String(active));
  });
  $$(".screen").forEach((section) => { section.hidden = section.dataset.screen !== route.screen; });

  const section = $(`#screen-${route.screen}`);
  renderScreen(route, section);
  updateHeader(route);

  if (previous) {
    if (previous.screen !== route.screen) {
      section.classList.remove("is-entering");
      void section.offsetWidth;          // restarts the animation
      section.classList.add("is-entering");
    }
    window.scrollTo(0, app.scroll[pageKey(route)] || 0);
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
  } else if (isReport(route)) {
    // « ‹ Infos »: back in the history if we came from Infos, otherwise open Infos.
    const fromInfos = app.previous && app.previous.screen === "infos" && !app.previous.param;
    renderRelecture(section, app.reviser, { onBack: () => (fromInfos ? history.back() : go("infos")) });
  } else {
    renderInfos(section, app.model, APP_VERSION, app.reviser);
  }
}

// « Mode relecture » switched on or off in Infos: rebuild Réviser for the new mode.
window.addEventListener("relecture-change", () => {
  buildReviser();
  const route = app.route;
  if (route && (route.screen === "infos" || route.screen === "reviser")) {
    renderScreen(route, $(`#screen-${route.screen}`));
  }
});

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
    if (app.route) updateHeader(app.route);
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
  updateHeader(readRoute());
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
