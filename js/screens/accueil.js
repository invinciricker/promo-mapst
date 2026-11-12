/* =====================================================================================
   accueil.js: the home of the app (docs/design/prototype.html, block 5). One fixed
   screen, no scrolling, and almost nothing on it:

     - The Baie des Anges, full screen and moving. The picture is put INSIDE the page
       (not as an <img>) so that its parts can move: the clouds, the boat, the sea (the
       rules are in css/08-accueil.css). Which sky: the one of Nice right now
       (js/core/sun.js); #accueil?ciel=aube (or jour, couchant, nuit) forces one.
       It only moves while Accueil is the screen shown.
     - Top left: « Bonjour Sam » (« Bonsoir » from 18:00), the date, and « Installer
       l'appli » while the app isn't installed. Top right: the round button to Profil.
     - Just above the tab bar, « le mot »: one short line that changes every 9 seconds,
       from content/mots.json (the owner's lines) and content/savais-tu.json (course
       facts). A fact opens its theme in Réviser.
     - « En ce moment »: what is on now, or next (js/planning/today.js). It opens the
       details of that half-day.
   Nothing else: the tab bar leads everywhere.
   ===================================================================================== */

import { esc, icon, typo, isInstalled } from "../core/dom.js";
import { capitalize, longDate, clock, duration, toISO, parseISO, daysBetween, dayMonth, DAYS } from "../core/dates.js";
import { push, switchTab } from "../core/nav.js";
import { data } from "../core/data.js";
import { firstName, initial } from "../core/user.js";
import { skyAt, SKIES } from "../core/sun.js";
import { paintStatusBar } from "../core/statusbar.js";
import { todayStatus } from "../planning/today.js";
import { openSlotDetails } from "../planning/details.js";
import { requestInstall } from "./install.js";

const MOT_SHOWN = 8600;      // a line is shown this long (milliseconds)...
const MOT_FADE = 400;        // ...then fades out before the next one
const OPENING = 2200;        // the entrance of the app
const svgCache = new Map();  // sky -> text of its picture, fetched once

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let home = null;             // the Accueil page, once drawn (for playOpening)

/**
 * Opening the app: the picture settles, the sun comes up, the words and the glass
 * follow (class is-opening, css/08-accueil.css). Once per launch; app.js calls it.
 */
export function playOpening() {
  const app = document.getElementById("app");
  if (!home || !app || app.dataset.tab !== "accueil" || reduceMotion()) return;
  home.classList.add("is-opening");
  app.classList.add("is-opening");
  setTimeout(() => {
    if (home) home.classList.remove("is-opening");
    app.classList.remove("is-opening");
  }, OPENING);
}

/** The picture of a sky, as text (so it can go inside the page). */
async function skySVG(sky) {
  if (!svgCache.has(sky)) {
    const response = await fetch(`img/baie-${sky}.svg`);
    if (!response.ok) throw new Error(`baie-${sky}.svg: ${response.status}`);
    svgCache.set(sky, await response.text());
  }
  return svgCache.get(sky);
}

/** « demain 9:00 », « lundi 9:00 », or « 4 janv. 9:00 » when it is more than a week away. */
function whenLabel(x, now) {
  const days = daysBetween(now, parseISO(x.iso));
  const time = clock(x.item.start);
  if (days <= 0) return `à ${time}`;
  if (days === 1) return `demain ${time}`;
  if (days < 7) return `${DAYS[parseISO(x.iso).getDay()]} ${time}`;
  return `${dayMonth(parseISO(x.iso))} ${time}`;
}

/**
 * @param el     the page element
 * @param query  the options of its address (ciel=nuit forces a sky)
 */
export function mountAccueil(el, query = new URLSearchParams()) {
  let forcedQuery = query;
  let sky = "";              // the sky shown
  let lastTop = "";          // what the top of the screen says (drawn again only when it changes)
  let active = false;        // is Accueil the screen shown?
  let slotId = "";           // the half-day « En ce moment » opens
  let motIndex = null;       // which line « le mot » shows
  let motTimer = null;
  let fadeTimer = null;
  let alive = true;

  el.classList.add("home");
  el.innerHTML = `
    <div class="home__sky" aria-hidden="true"></div>
    <div class="home__shade" aria-hidden="true"></div>
    <header class="home__top"></header>
    <div class="home__dock">
      <p class="mot" style="--i:0" aria-live="off" hidden></p>
      <button type="button" class="now glass tap" style="--i:1" data-now></button>
    </div>`;
  const skyBox = el.querySelector(".home__sky");
  const top = el.querySelector(".home__top");
  const motEl = el.querySelector(".mot");
  const nowEl = el.querySelector(".now");
  home = el;

  // ---------------------------------------------------------------------------------
  // The sky
  // ---------------------------------------------------------------------------------
  /** The sky to show: the one forced in the address (?ciel=nuit), or the real one. */
  function skyFor(now) {
    const forced = forcedQuery.get("ciel");
    return SKIES.includes(forced) ? forced : skyAt(now);
  }

  async function setSky(next) {
    if (next === sky) return;
    sky = next;
    el.dataset.ciel = next;                                   // text colour, glass (the styles)
    document.getElementById("app").dataset.ciel = next;       // the tab bar at night
    paintStatusBar();
    let text;
    try {
      text = await skySVG(next);
    } catch (error) {
      return;                                                 // no picture: the plain sky colour stays
    }
    if (!alive || sky !== next) return;                       // it changed again meanwhile
    const old = [...skyBox.querySelectorAll("svg")];
    skyBox.insertAdjacentHTML("beforeend", text);
    const svg = skyBox.lastElementChild;
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("preserveAspectRatio", "xMidYMax slice");   // anchored at the bottom
    svg.setAttribute("aria-hidden", "true");
    svg.removeAttribute("role");
    svg.removeAttribute("aria-label");
    // The sky changed while the app is open: the old one fades away over the new one.
    old.forEach((node) => {
      skyBox.appendChild(node);
      node.classList.add("old");
      requestAnimationFrame(() => { node.style.opacity = 0; });
      setTimeout(() => node.remove(), 950);
    });
  }

  // ---------------------------------------------------------------------------------
  // The top: the greeting, the date, « Installer l'appli », the way to Profil
  // ---------------------------------------------------------------------------------
  function drawTop(now) {
    const name = firstName();
    const letter = initial(name);
    const words = [now.getHours() >= 18 ? "Bonsoir" : "Bonjour"].concat(name ? [name] : []);
    const html = `
      <div class="home__who">
        <h1 class="home__hello">${words.map((w, i) => `<span style="--i:${i}">${esc(w)}</span>`).join(" ")}</h1>
        <p class="home__date">${esc(capitalize(longDate(now)))}</p>
        ${isInstalled() ? "" : `<button type="button" class="install glass tap" data-install>${icon("phone", "icon--s")}Installer l’appli${icon("right", "icon--xs")}</button>`}
      </div>
      <button type="button" class="home__me glass tap" data-profil aria-label="Profil${name ? ` de ${esc(name)}` : ""}">${letter ? esc(letter) : icon("person", "icon--s")}</button>`;
    if (html === lastTop) return;
    lastTop = html;
    top.innerHTML = html;
  }

  // ---------------------------------------------------------------------------------
  // « En ce moment »
  // ---------------------------------------------------------------------------------
  function drawNow(now) {
    const model = data.model;
    slotId = "";
    if (!model) {
      nowEl.className = "now glass tap";
      nowEl.innerHTML = typo(`<div class="now__label">Planning indisponible</div>
        <div class="now__title">Il n’a pas pu se charger.</div>
        <div class="now__place">Vérifie ta connexion.</div>`);
      return;
    }
    const st = todayStatus(model, now);
    let label = "";
    let right = "";
    let shown = null;         // the half-day the card talks about
    let bar = "";
    if (st.kind === "now") {
      shown = st.current;
      const pct = Math.max(2, Math.min(100, ((now - shown.start) / (shown.end - shown.start)) * 100));
      label = `<i class="pulse" aria-hidden="true"></i>En ce moment`;
      right = `encore ${duration((shown.end - now) / 60000)}`;
      bar = `<div class="now__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="Avancement de la demi-journée"><i style="width:${pct.toFixed(1)}%"></i></div>
        <div class="now__times"><span>${esc(clock(shown.item.start))}</span><span>${esc(clock(shown.item.end))}</span></div>`;
    } else if (st.kind === "next") {
      shown = st.next;
      label = "Ensuite";
      right = whenLabel(shown, now);
    } else {
      shown = st.next;
      label = esc(st.off.title);
      right = shown ? whenLabel(shown, now) : "";
    }

    // Under it, at most one extra line: an épreuve or a dossier within 14 days, else
    // today's personal event (and « +1 » if there are more).
    let extra = "";
    if (st.deadline) {
      const d = st.deadline.days;
      extra = `${icon("flag", "icon--xs")}<span>${esc(st.deadline.k.title)} · ${d === 0 ? "aujourd’hui" : d === 1 ? "demain" : `J-${d}`}</span>`;
    } else if (st.personal.length) {
      const first = st.personal[0];
      extra = `${icon("cal", "icon--xs")}<span>Aussi aujourd’hui : ${esc(first.title)}${first.start ? `, ${esc(clock(first.start))}` : ""}${st.personal.length > 1 ? ` <b>+${st.personal.length - 1}</b>` : ""}</span>`;
    }

    slotId = shown ? shown.item.id : "";
    nowEl.className = `now glass tap${shown ? ` cat-${shown.item.cat}` : ""}`;
    nowEl.innerHTML = typo(`
      <div class="now__label">${label}${right ? `<b>${esc(right)}</b>` : ""}</div>
      <div class="now__title">${esc(shown ? shown.item.title : st.off.text)}</div>
      ${shown && shown.item.place ? `<div class="now__place">${esc(shown.item.place)}</div>` : ""}
      ${bar}
      ${extra ? `<div class="now__extra">${extra}</div>` : ""}`);
  }

  // ---------------------------------------------------------------------------------
  // « Le mot »
  // ---------------------------------------------------------------------------------
  /**
   * The line number `k`: with lines of the owner, one « mot », one fact, and so on;
   * without, facts only. Returns { label, text, theme } or null when there is nothing.
   */
  function motAt(k) {
    const mots = data.mots || [];
    const facts = data.facts || [];
    const fact = (i) => {
      const f = facts[i % facts.length];
      return { label: "Le savais-tu ?", text: f.text, theme: f.theme || "" };
    };
    const mot = (i) => {
      const m = mots[i % mots.length];
      return { label: `${m.label || "Le mot du jour"}${m.by ? ` · ${m.by}` : ""}`, text: m.text, theme: "" };
    };
    if (mots.length && facts.length) return k % 2 === 0 ? mot(k / 2) : fact((k - 1) / 2);
    if (mots.length) return mot(k);
    if (facts.length) return fact(k);
    return null;
  }

  function showMot() {
    // The first line of the day depends on the date, so it isn't the same every morning.
    if (motIndex === null) {
      const now = new Date();
      const dayNumber = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
      motIndex = dayNumber * 2;
    }
    const m = motAt(motIndex);
    motEl.hidden = !m;
    if (!m) return;
    const canOpen = Boolean(m.theme && data.reviser && data.reviser.theme(m.theme));
    motEl.classList.remove("is-out");
    motEl.classList.toggle("tap", canOpen);
    if (canOpen) {
      motEl.dataset.theme = m.theme;
      motEl.setAttribute("role", "button");
      motEl.tabIndex = 0;
    } else {
      delete motEl.dataset.theme;
      motEl.removeAttribute("role");
      motEl.removeAttribute("tabindex");
    }
    // The words arrive one by one (each in its own .w, with its number --n).
    const words = typo(m.text).split(" ").filter(Boolean);
    motEl.innerHTML = `<small>${esc(typo(m.label))}</small>` + words.map((w, n) => `<span class="w" style="--n:${n}">${esc(w)}</span>`).join(" ");
  }

  function nextMot() {
    motIndex += 1;
    showMot();
    scheduleMot();
  }

  /** Every 9 seconds: 8.6 s shown, 0.4 s of fade. Calm phones keep one line. */
  function scheduleMot() {
    clearTimeout(motTimer);
    clearTimeout(fadeTimer);
    if (!running() || reduceMotion() || motEl.hidden) return;
    fadeTimer = setTimeout(() => motEl.classList.add("is-out"), MOT_SHOWN);
    motTimer = setTimeout(nextMot, MOT_SHOWN + MOT_FADE);
  }

  // ---------------------------------------------------------------------------------
  // Only while Accueil is on screen: the picture moves, the lines change
  // ---------------------------------------------------------------------------------
  const running = () => alive && active && !document.hidden;

  function sync() {
    el.classList.toggle("is-on", running());
    if (running()) {
      motEl.classList.remove("is-out");
      scheduleMot();
    } else {
      clearTimeout(motTimer);
      clearTimeout(fadeTimer);
    }
  }

  function draw(now = new Date()) {
    setSky(skyFor(now));
    drawTop(now);
    drawNow(now);
    if (motIndex === null || motEl.hidden) showMot();
  }

  // ---------------------------------------------------------------------------------
  // Taps
  // ---------------------------------------------------------------------------------
  el.addEventListener("click", (event) => {
    const t = event.target;
    if (t.closest("[data-profil]")) push("accueil/profil");
    else if (t.closest("[data-install]")) requestInstall();
    else if (t.closest(".mot[data-theme]")) switchTab("reviser", { push: `reviser/${motEl.dataset.theme}` });
    else if (t.closest("[data-now]")) {
      const item = slotId && data.model ? data.model.slotById(slotId) : null;
      if (item) openSlotDetails(data.model, item);
      else switchTab("planning");
    }
  });
  motEl.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && motEl.dataset.theme) { event.preventDefault(); motEl.click(); }
  });

  // The name changed (welcome, Profil): the greeting follows.
  const onName = () => draw();
  window.addEventListener("prenom-change", onName);
  document.addEventListener("visibilitychange", sync);

  draw();
  return {
    title: "",
    refresh: () => { draw(); if (!motAt(motIndex || 0)) motEl.hidden = true; },
    onShow: () => draw(),
    onActive(on) { active = on; sync(); },
    destroy() {
      alive = false;
      sync();
      window.removeEventListener("prenom-change", onName);
      document.removeEventListener("visibilitychange", sync);
      if (home === el) home = null;
    },
    /** Every 30 seconds (app.js), and when the app comes back on screen. */
    tick: (now = new Date()) => draw(now),
    /** The address changed: #accueil?ciel=nuit forces a sky, #accueil the real one again. */
    onQuery(next) {
      forcedQuery = next;
      draw();
    },
  };
}
