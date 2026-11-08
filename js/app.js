/* =====================================================================================
   app.js: starts the app.

   1. Registers the offline mode (core/offline.js and sw.js).
   2. Loads the content: content/planning.json, content/themes.json,
      content/planning-themes.json and content/questions.json (shared in core/data.js).
   3. Starts the navigation (core/nav.js) on the address of the page (#accueil by
      default): pageFor() below says which page each address shows.
   4. Shows the welcome on the first launch (screens/welcome.js).
   5. Every 30 seconds, and when the app comes back on screen, Accueil and the Planning
      follow the time (what is on now, the sky...). After a long while away, the content
      is fetched again, so new questions or a new planning show up by themselves.
   ===================================================================================== */

import { startNav, refreshPages } from "./core/nav.js";
import { startOffline } from "./core/offline.js";
import { showToast } from "./core/toast.js";
import { toISO } from "./core/dates.js";
import { data } from "./core/data.js";
import { welcomeDone } from "./core/user.js";
import { createPlanning } from "./planning/model.js";
import { mountPlanning } from "./planning/planning.js";
import { mountKeyDates } from "./planning/dates-cles.js";
import { createReviserContent } from "./reviser/content.js";
import { mountReviserHome, mountTheme } from "./reviser/reviser.js";
import { isPlaying } from "./reviser/player.js";
import { isRelectureOn } from "./reviser/relecture.js";
import { mountAccueil } from "./screens/accueil.js";
import { mountProfil, mountAboutPlanning, mountStoredData } from "./screens/profil.js";
import { mountRelecture } from "./screens/relecture.js";
import { showWelcome } from "./screens/welcome.js";

const raw = {
  themesText: "",       // raw text of themes.json, to notice when it changes
  questions: [],        // content/questions.json, as written in the file
  questionsText: "",
  links: [],            // content/planning-themes.json
  planningText: "",     // raw text of planning.json, to notice when it changes
};
const live = new Set();  // the pages drawn now that follow the clock (Accueil, Planning)
let hiddenAt = 0;
let day = toISO(new Date());

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

/** Builds Réviser from the themes and the questions, for the mode chosen in Profil. */
function buildReviser() {
  data.reviser = createReviserContent(data.themes, raw.questions, { relecture: isRelectureOn() });
}

function buildPlanning(text) {
  try {
    data.model = createPlanning(JSON.parse(text), data.themes, raw.links);
    raw.planningText = text;
  } catch (error) {
    console.error("content/planning.json :", error);
  }
}

async function loadContent() {
  const [themesText, links, questionsText, planningText] = await Promise.all([
    fetchText("content/themes.json").catch(() => "[]"),
    fetchText("content/planning-themes.json").then(JSON.parse).catch(() => []),
    fetchText("content/questions.json").catch(() => "[]"),
    fetchText("content/planning.json").catch((error) => { console.error(error); return null; }),
  ]);
  raw.themesText = themesText;
  data.themes = parseList(themesText, "content/themes.json");
  raw.links = Array.isArray(links) ? links : [];
  raw.questionsText = questionsText;
  raw.questions = parseList(questionsText, "content/questions.json");
  buildReviser();
  // If the planning can't load, Accueil and the Planning tab say so, and Réviser still works.
  if (planningText) buildPlanning(planningText);
}

/** Back on screen after a long time: new questions or lesson titles, or a newer planning? */
async function refreshContent() {
  let changed = false;
  try {
    if (isPlaying()) throw new Error("a lesson is open: try again next time");
    const [themesText, questionsText] = await Promise.all([
      fetchText("content/themes.json"), fetchText("content/questions.json")]);
    if ((themesText !== raw.themesText || questionsText !== raw.questionsText) && !isPlaying()) {
      const before = new Set(data.reviser.all.map((q) => q.id));
      raw.themesText = themesText;
      data.themes = parseList(themesText, "content/themes.json");
      raw.questionsText = questionsText;
      raw.questions = parseList(questionsText, "content/questions.json");
      buildReviser();
      changed = true;
      if (data.reviser.all.some((q) => !before.has(q.id))) showToast("Nouvelles questions disponibles");
    }
  } catch (error) {
    /* offline, or a lesson is open: keep what we have */
  }
  try {
    const text = await fetchText("content/planning.json");
    if (text !== raw.planningText) {
      buildPlanning(text);
      changed = true;
      showToast("Planning mis à jour");
    }
  } catch (error) {
    /* offline: keep what we have */
  }
  if (changed) refreshPages();
}

// -------------------------------------------------------------------------------------
// Pages: which page each address shows
// -------------------------------------------------------------------------------------
function pageFor(path, el, { query }) {
  const [tab, sub, more] = path.split("/");
  let page = null;
  if (tab === "accueil") {
    if (!sub) page = mountAccueil(el, query);
    else if (sub === "profil" && !more) page = mountProfil(el);
    else if (sub === "profil" && more === "relecture") page = mountRelecture(el, { backLabel: "Profil" });
    else if (sub === "profil" && more === "planning") page = mountAboutPlanning(el);
    else if (sub === "profil" && more === "donnees") page = mountStoredData(el);
  } else if (tab === "reviser") {
    if (!sub) page = mountReviserHome(el);
    else if (sub === "relecture" && !more) page = mountRelecture(el, { backLabel: "Réviser" });
    else if (!more) page = mountTheme(el, sub);
  } else if (tab === "planning") {
    if (!sub) page = mountPlanning(el);
    else if (sub === "dates-cles" && !more) page = mountKeyDates(el);
  }
  if (page && page.tick) {
    live.add(page);
    const destroy = page.destroy;
    page.destroy = () => { live.delete(page); if (destroy) destroy(); };
  }
  return page;
}

// « Mode relecture » switched on or off in Profil: Réviser is built again for the new mode.
window.addEventListener("relecture-change", () => {
  buildReviser();
  refreshPages();
});

// -------------------------------------------------------------------------------------
// Following the time
// -------------------------------------------------------------------------------------
function tick() {
  const now = new Date();
  const today = toISO(now);
  if (today !== day) {
    day = today;
    refreshPages();           // a new day: the série, « Mes erreurs », the planning...
  }
  live.forEach((page) => page.tick(now));
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    return;
  }
  tick();
  if (hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000) refreshContent();
});

// -------------------------------------------------------------------------------------
// Start
// -------------------------------------------------------------------------------------
async function boot() {
  startOffline();
  try {
    await loadContent();
  } catch (error) {
    console.error(error);
  }
  startNav({ pageFor });
  if (!welcomeDone()) showWelcome({ onDone: () => refreshPages() });
  setInterval(tick, 30 * 1000);
  document.documentElement.classList.add("is-ready");
}

boot();
