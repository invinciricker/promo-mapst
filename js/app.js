/* =====================================================================================
   app.js: starts the app.

   1. Registers the offline mode (core/offline.js and sw.js).
   2. Loads the content: content/planning.json, content/themes.json,
      content/planning-themes.json, content/questions.json, since Phase 4
      content/parcours.json, content/documents.json, content/mots.json and
      content/savais-tu.json, and since Phase 5 content/lecons/index.json (shared in
      core/data.js). The text of each lesson is then fetched in the background, so that
      it works offline too (js/cours/lecons.js).
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
import { isInstalled } from "./core/dom.js";
import { welcomeDone } from "./core/user.js";
import { createCours } from "./cours/content.js";
import { mountCours, mountChapter, mountAllDocuments } from "./cours/cours.js";
import { prefetchLessons } from "./cours/lecons.js";
import "./cours/lecon.js";                  // the lesson screen and its address (?lecon=…)
import { createPlanning } from "./planning/model.js";
import { mountPlanning } from "./planning/planning.js";
import { mountKeyDates } from "./planning/dates-cles.js";
import { createReviserContent } from "./reviser/content.js";
import { mountReviserHome, mountTheme } from "./reviser/reviser.js";
import { isPlaying } from "./reviser/player.js";
import { isRelectureOn } from "./reviser/relecture.js";
import { mountAccueil, playOpening } from "./screens/accueil.js";
import { mountProfil, mountAboutPlanning, mountStoredData } from "./screens/profil.js";
import { mountRelecture } from "./screens/relecture.js";
import { showWelcome } from "./screens/welcome.js";

const raw = {
  themesText: "",       // raw text of themes.json, to notice when it changes
  questions: [],        // content/questions.json, as written in the file
  questionsText: "",
  links: [],            // content/planning-themes.json
  planningText: "",     // raw text of planning.json, to notice when it changes
  parcours: null,       // content/parcours.json
  documents: null,      // content/documents.json
  lecons: null,         // content/lecons/index.json
  extraText: "",        // raw text of the Phase 4 and 5 files, to notice when one changes
};
const EXTRA_FILES = ["content/parcours.json", "content/documents.json", "content/mots.json", "content/savais-tu.json",
  "content/lecons/index.json"];
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

/** Reads a JSON file's text; a broken file gives `fallback` (and a message in the console). */
function parseJSON(text, name, fallback) {
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error(`${name} n’est pas un JSON valide :`, error);
    return fallback;
  }
}

/** Cours (the path of chapters) is built from parcours.json, documents.json, the lessons and Réviser. */
function buildCours() {
  data.cours = createCours(raw.parcours, raw.documents, data.reviser, raw.lecons);
}

/**
 * The files of Phase 4 and 5: the path, the documents, the lines and the facts of Accueil,
 * the list of the lessons.
 */
async function loadExtras() {
  const texts = await Promise.all(EXTRA_FILES.map((path) => fetchText(path).catch(() => "")));
  const joined = texts.join("\u0000");
  if (joined === raw.extraText) return false;
  // Offline with nothing saved: keep what we have rather than emptying the screens.
  if (raw.extraText && texts.every((t) => !t)) return false;
  raw.extraText = joined;
  const [parcours, documents, mots, facts, lecons] = texts.map((t, i) => (t ? parseJSON(t, EXTRA_FILES[i], null) : null));
  raw.parcours = parcours;
  raw.documents = documents;
  raw.lecons = lecons;
  data.mots = mots && Array.isArray(mots.mots) ? mots.mots.filter((m) => m && typeof m.text === "string" && m.text.trim()) : [];
  data.facts = Array.isArray(facts) ? facts.filter((f) => f && typeof f.text === "string" && f.text.trim()) : [];
  buildCours();
  return true;
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
  await loadExtras();
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
      buildCours();
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
  try {
    if (await loadExtras()) changed = true;      // new documents, a new line for Accueil...
  } catch (error) {
    /* offline: keep what we have */
  }
  if (changed) refreshPages();
  fetchLessonTexts();                             // a lesson may have been rewritten
}

/**
 * The texts of the lessons, fetched quietly a moment after the start (sw.js saves them,
 * so a lesson works offline even before it is opened). The pages are drawn again after,
 * for the Relecture report, which compares each lesson with the verdict given on it.
 */
function fetchLessonTexts() {
  if (!data.cours || !data.cours.lessons.length) return;
  prefetchLessons(data.cours.lessons).then(() => { if (isRelectureOn()) refreshPages(); });
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
  } else if (tab === "cours") {
    if (!sub) page = mountCours(el);
    else if (sub === "documents" && !more) page = mountAllDocuments(el);
    else if (!more) page = mountChapter(el, sub);
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
  buildCours();
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
  // Installed (opened from the home screen): the « Installer l'appli » buttons are never shown.
  document.getElementById("app").classList.toggle("is-installed", isInstalled());
  startNav({ pageFor });
  // Opening the app: the picture of Accueil settles and its pieces land, once. With the
  // welcome on top (first launch), it plays when the welcome closes.
  if (welcomeDone()) playOpening();
  else showWelcome({ onDone: () => { refreshPages(); playOpening(); } });
  setInterval(tick, 30 * 1000);
  document.documentElement.classList.add("is-ready");
  setTimeout(fetchLessonTexts, 1500);
}

boot();
