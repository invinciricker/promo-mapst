/* =====================================================================================
   planning.js: the first page of the Planning tab. It puts the pieces together:
     - the coloured header: « Planning », « Aujourd'hui » and « + » (a personal event),
       the Semaine / Mois / Année switch, the label of the period with its two arrows
     - the view itself (view-week.js, view-month.js, view-year.js), on the rounded sheet
       under the header; in Semaine the day cards, in Mois the calendar, sit half on it
     - « Dates clés » (its own page, dates-cles.js) and « Ajouter à ton agenda » (export.js)
   Semaine: the arrows change the week, the strip of day cards slides sideways, a tap on
   a card or a swipe on the list changes the day. Mois: arrows or a swipe on the calendar
   change the month. On a laptop, the keyboard arrows work too. The colour legend opens
   from the small « Couleurs » chip (Mois and Année).
   ===================================================================================== */

import { $, $$, esc, icon, setHTML } from "../core/dom.js";
import { load, save } from "../core/storage.js";
import { parseISO, toISO, addDays, addMonths, startOfWeek, startOfMonth, capitalize, MONTHS, dayMonth } from "../core/dates.js";
import { FOOTER } from "../core/texts.js";
import { data } from "../core/data.js";
import { push, current as currentPage, hasModal, registerModal } from "../core/nav.js";
import { onPersonalChange } from "./personal.js";
import { weekViewHTML, weekTitle } from "./view-week.js";
import { monthViewHTML } from "./view-month.js";
import { yearViewHTML } from "./view-year.js";
import { openLegendSheet } from "./parts.js";
import { openSlotDetails } from "./details.js";
import { openEventForm } from "./event-form.js";
import { openExportSheet } from "./export.js";

const VIEWS = [
  { id: "semaine", label: "Semaine" },
  { id: "mois", label: "Mois" },
  { id: "annee", label: "Année" },
];

let controller = null;      // the Planning page, once drawn (for showPlanningDay)

/** Opens the Planning on a day (from « Dates clés »). */
export function showPlanningDay(iso) {
  if (controller) controller.showDay(iso);
}

/** The first page of the Planning tab. Returns the page for nav.js. */
export function mountPlanning(el) {
  if (!data.model) return mountLoadError(el);
  const now0 = new Date();
  const saved = load("planning-view", "semaine");
  const state = {
    view: VIEWS.some((v) => v.id === saved) ? saved : "semaine",
    selected: toISO(data.model.clamp(new Date(now0.getFullYear(), now0.getMonth(), now0.getDate()))),
    today: toISO(now0),
  };
  const model = () => data.model;

  // ---------------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------------
  /** The label of the period (« 9 – 15 novembre », « Novembre 2026 », « 2026 – 2027 ») and its arrows. */
  function headHTML() {
    const m = model();
    if (state.view === "annee") {
      return `<span aria-live="polite">${m.seasonStart.getFullYear()} – ${m.seasonEnd.getFullYear()}</span>`;
    }
    const sel = parseISO(state.selected);
    const week = state.view === "semaine";
    const title = week ? weekTitle(startOfWeek(sel)) : `${capitalize(MONTHS[sel.getMonth()])} ${sel.getFullYear()}`;
    return `<span aria-live="polite">${esc(title)}</span>
        <span class="arrows">
          <button type="button" class="arrow tap" data-step="-1" aria-label="${week ? "Semaine précédente" : "Mois précédent"}"${canStep(-1) ? "" : " disabled"}>${icon("left", "icon--s")}</button>
          <button type="button" class="arrow tap" data-step="1" aria-label="${week ? "Semaine suivante" : "Mois suivant"}"${canStep(1) ? "" : " disabled"}>${icon("right", "icon--s")}</button>
        </span>`;
  }

  function viewHTML(now = new Date()) {
    const m = model();
    if (state.view === "semaine") return weekViewHTML(m, state.selected, now);
    if (state.view === "mois") return monthViewHTML(m, state.selected, now);
    return yearViewHTML(m, now);
  }

  /** « Dates clés » and « Ajouter à ton agenda », under the view. */
  function linksHTML() {
    const next = model().upcomingDeadlines(state.today, 1)[0];
    const nextText = next ? `Prochaine : ${next.title.replace(/ à rendre$/, "").replace(/^Dossier/, "dossier")}, ${dayMonth(parseISO(next.date)).replace(".", "")}` : "Épreuves, dossiers, vacances";
    return `<div class="list pl-links rise" style="--i:4">
        <button type="button" class="row tap tone-bougainvillier" data-dates-cles>
          <span class="tile-icon">${icon("flag", "icon--s")}</span>
          <span class="row__main"><span class="row__title">Dates clés</span><span class="row__sub">${esc(nextText)}</span></span>
          ${icon("right", "chev")}</button>
        <button type="button" class="row tap tone-azur" data-export>
          <span class="tile-icon">${icon("cal-add", "icon--s")}</span>
          <span class="row__main"><span class="row__title">Ajouter à ton agenda</span><span class="row__sub">Google Agenda ou Calendrier d’Apple</span></span>
          ${icon("right", "chev")}</button>
      </div>`;
  }

  /** Everything under the header: the view, then the two links and the footer. */
  const bodyHTML = (now = new Date()) => `${viewHTML(now)}${linksHTML()}<p class="footer-note">${esc(FOOTER)}</p>`;

  /**
   * Puts the body in place. In Semaine and Mois something straddles the header (the day
   * cards, the calendar), so the header is taller (hd--lift). In Semaine the chosen day
   * card is brought to the middle of the strip (gently when the strip was already there).
   */
  function renderBody(now = new Date()) {
    const body = $(".body", el);
    const before = $(".days", el);
    const keep = before ? { week: before.dataset.week, left: before.scrollLeft } : null;
    $(".hd", el).classList.toggle("hd--lift", state.view !== "annee");
    body.classList.toggle("body--lift", state.view === "mois");
    setHTML(body, bodyHTML(now));
    bindSwipes();
    const strip = $(".days", el);
    if (!strip) return;
    strip.dataset.week = toISO(startOfWeek(parseISO(state.selected)));
    if (keep && keep.week === strip.dataset.week) {
      strip.scrollLeft = keep.left;
      centerDay(true);
    } else {
      centerDay(false);
    }
  }

  /** Brings the chosen day card to the middle of the strip. */
  function centerDay(smooth) {
    const strip = $(".days", el);
    const on = strip && $(".dcard.on", strip);
    if (!on || !strip.clientWidth) return;       // not on screen yet: onShow does it
    const left = on.offsetLeft - strip.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2;
    if (smooth) strip.scrollTo({ left, behavior: "smooth" });
    else strip.scrollLeft = left;
  }

  function draw() {
    setHTML(el, `
      <div class="topbar">Planning</div>
      <header class="hd hd--lift">
        <div class="hd__row">
          <h1 class="hd__title">Planning</h1>
          <span class="hd__end pl-actions">
            <button type="button" class="gchip gchip--text tap" data-today>Aujourd’hui</button>
            <button type="button" class="gbtn tap" data-add-event aria-label="Ajouter un événement perso">${icon("plus", "icon--s")}</button>
          </span>
        </div>
        <div class="gseg" role="radiogroup" aria-label="Affichage du planning">
          ${VIEWS.map((v) => `<button type="button" class="gseg__btn tap" role="radio" aria-checked="${v.id === state.view}" data-view="${v.id}">${v.label}</button>`).join("")}
        </div>
        <div class="weekhead">${headHTML()}</div>
      </header>
      <div class="body pl pl-view"></div>`);
    renderBody();
  }

  /** Draws the label and the view again, with a slide (1: from the right, -1: from the left). */
  function redraw(direction = 0, { strip = true } = {}) {
    setHTML($(".weekhead", el), headHTML());
    renderBody();
    if (direction) {
      const targets = state.view === "semaine"
        ? (strip ? [$(".days", el), $(".pl-daylist", el)] : [$(".pl-daylist", el)])
        : state.view === "mois" ? [$(".pl-daylist", el)] : [];
      targets.filter(Boolean).forEach((node) => {
        node.classList.remove("anim-from-right", "anim-from-left", "rise");
        void node.offsetWidth;            // restarts the animation
        node.classList.add(direction > 0 ? "anim-from-right" : "anim-from-left");
      });
    }
  }

  /** The segmented control shows the view chosen. */
  function placeThumb() {
    $$(".gseg__btn", el).forEach((b) => b.setAttribute("aria-checked", String(b.dataset.view === state.view)));
  }

  // ---------------------------------------------------------------------------------
  // Moving in time
  // ---------------------------------------------------------------------------------
  function stepDate(dir) {
    const sel = parseISO(state.selected);
    if (state.view === "semaine") return addDays(sel, 7 * dir);
    const first = addMonths(startOfMonth(sel), dir);
    return defaultDayOfMonth(first);
  }

  function canStep(dir) {
    if (state.view === "annee") return false;
    const m = model();
    if (state.view === "semaine") {
      const monday = startOfWeek(addDays(parseISO(state.selected), 7 * dir));
      return addDays(monday, 6) >= m.firstDay && monday <= m.lastDay;
    }
    return m.inRange(addMonths(startOfMonth(parseISO(state.selected)), dir));
  }

  /** In a month: today if it is in it, otherwise its first day with a class. */
  function defaultDayOfMonth(first) {
    if (state.today.slice(0, 7) === toISO(first).slice(0, 7)) return parseISO(state.today);
    for (let d = first; d.getMonth() === first.getMonth(); d = addDays(d, 1)) {
      if (model().day(toISO(d)).slots.some((s) => !s.free)) return d;
    }
    return first;
  }

  function step(dir) {
    if (!canStep(dir)) return;
    state.selected = toISO(model().clamp(stepDate(dir)));
    redraw(dir);
  }

  /** Swipe on the list of the day: the day before or after. */
  function stepDay(dir) {
    const next = addDays(parseISO(state.selected), dir);
    if (!model().inRange(next)) return;
    const sameWeek = toISO(startOfWeek(next)) === toISO(startOfWeek(parseISO(state.selected)));
    state.selected = toISO(next);
    redraw(dir, { strip: !sameWeek });
  }

  function selectDay(iso) {
    const before = state.selected;
    if (iso === before) return;
    state.selected = iso;
    const dir = iso > before ? 1 : -1;
    const sameWeek = toISO(startOfWeek(parseISO(iso))) === toISO(startOfWeek(parseISO(before)));
    const sameMonth = iso.slice(0, 7) === before.slice(0, 7);
    if (state.view === "semaine") redraw(dir, { strip: !sameWeek });
    else if (state.view === "mois" && !sameMonth) redraw(dir);
    else redraw(0);
  }

  function setView(view, iso = null) {
    state.view = view;
    if (iso) state.selected = toISO(model().clamp(parseISO(iso)));
    save("planning-view", view);
    placeThumb();
    redraw(0);
    const scroller = el;
    if (view === "annee") {
      const currentMonth = $(".ymonth.is-current", el);
      if (currentMonth) currentMonth.scrollIntoView({ block: "center" });
    } else if (scroller.scrollTop > 200) {
      scroller.scrollTo({ top: 0 });
    }
  }

  function goToday() {
    const before = state.selected;
    state.selected = toISO(model().clamp(parseISO(state.today)));
    if (state.view === "annee") {
      const month = $(".ymonth.is-current", el);
      if (month) month.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    redraw(state.selected > before ? 1 : state.selected < before ? -1 : 0);
    if (el.scrollTop > 120) el.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------------------------------------------------------------------------------
  // Taps, swipes and keys
  // ---------------------------------------------------------------------------------
  el.addEventListener("click", (event) => {
    const t = event.target.closest(
      "[data-view],[data-step],[data-today],[data-open-slot],[data-edit-event],[data-add-event],[data-select-day],[data-goto-week],[data-goto-month],[data-export],[data-legend],[data-dates-cles]");
    if (!t) return;
    const d = t.dataset;
    if (d.view) { if (d.view !== state.view) setView(d.view); }
    else if (d.step) step(Number(d.step));
    else if ("today" in d) goToday();
    else if (d.openSlot) {
      const slot = model().slotById(d.openSlot);
      if (slot) openSlotDetails(model(), slot);
    } else if (d.editEvent) openEventForm({ eventId: d.editEvent });
    else if ("addEvent" in d) openEventForm({ date: state.selected >= state.today ? state.selected : state.today });
    else if (d.selectDay) selectDay(d.selectDay);
    else if (d.gotoWeek) setView("semaine", d.gotoWeek);
    else if (d.gotoMonth) setView("mois", toISO(defaultDayOfMonth(parseISO(d.gotoMonth))));
    else if ("export" in d) openExportSheet();
    else if ("legend" in d) openLegendSheet(model());
    else if ("datesCles" in d) push("planning/dates-cles");
  });

  // Keyboard arrows (on a laptop) move in time.
  function onKey(event) {
    if (el.hidden || el.closest(".panel").hidden || hasModal() || event.altKey || event.ctrlKey || event.metaKey) return;
    if (currentPage().path !== "planning") return;
    if (event.target.closest("input, textarea, select, [role=radiogroup]")) return;
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  }
  document.addEventListener("keydown", onKey);

  /** Horizontal swipes: on the strip (week), the list of the day (day), the month. */
  function bindSwipes() {
    $$("[data-swipe]", el).forEach((node) => {
      if (node.dataset.bound) return;
      node.dataset.bound = "1";
      const kind = node.dataset.swipe;
      enableSwipe(node, (dir) => (kind === "day" ? stepDay(dir) : step(dir)));
    });
  }

  // Personal events changed: redraw.
  const stop = onPersonalChange(() => redraw(0));

  draw();
  requestAnimationFrame(() => centerDay(false));   // once the page is in place
  controller = {
    showDay(iso) {
      if (state.view === "annee") state.view = "semaine";
      state.selected = toISO(model().clamp(parseISO(iso)));
      save("planning-view", state.view);
      placeThumb();
      redraw(0);
    },
  };

  return {
    title: "Planning",
    refresh: draw,
    onShow: () => centerDay(false),
    destroy() { stop(); document.removeEventListener("keydown", onKey); controller = null; },
    /** Called every 30 seconds by app.js: a new day, or « En cours » that moves on. */
    tick(now = new Date()) {
      const todayIso = toISO(now);
      if (todayIso !== state.today) {
        const wasToday = state.selected === state.today;
        state.today = todayIso;
        if (wasToday) state.selected = toISO(model().clamp(parseISO(todayIso)));
        redraw(0);
      } else if (state.selected === todayIso && state.view !== "annee") {
        renderBody(now);
      }
    },
  };
}

/** The planning could not load (first visit without internet...). */
function mountLoadError(el) {
  setHTML(el, `<div class="topbar">Planning</div>
      <header class="hd"><div class="hd__row"><h1 class="hd__title">Planning</h1></div></header>
      <div class="body">
      <div class="card empty">${icon("alert")}
        <b>Le planning n’a pas pu se charger.</b>
        <p>Vérifie ta connexion internet, puis réessaie. Après une première visite, l’appli marche aussi sans internet.</p>
        <button type="button" class="btn btn--primary" data-reload>Réessayer</button>
      </div></div>`);
  el.addEventListener("click", (event) => { if (event.target.closest("[data-reload]")) location.reload(); });
  return { title: "Planning" };
}

/** Horizontal swipe on an element: calls onStep(+1) to go forward, onStep(-1) back. */
function enableSwipe(node, onStep) {
  let x0 = 0, y0 = 0, dx = 0, tracking = false, horizontal = null;
  const reset = () => { node.style.transform = ""; node.style.transition = ""; };

  node.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) return;
    // A swipe that starts at the very left edge is the « back » gesture, not this one.
    if (event.touches[0].clientX < 30) return;
    tracking = true;
    horizontal = null;
    dx = 0;
    x0 = event.touches[0].clientX;
    y0 = event.touches[0].clientY;
  }, { passive: true });

  node.addEventListener("touchmove", (event) => {
    if (!tracking) return;
    dx = event.touches[0].clientX - x0;
    const dy = event.touches[0].clientY - y0;
    if (horizontal === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) horizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
    if (horizontal) {
      node.style.transition = "none";
      node.style.transform = `translateX(${dx * 0.35}px)`;   // follows the finger, a bit slower
    }
  }, { passive: true });

  node.addEventListener("touchend", () => {
    if (!tracking) return;
    tracking = false;
    reset();
    if (horizontal && Math.abs(dx) > 50) onStep(dx < 0 ? 1 : -1);
  });
  node.addEventListener("touchcancel", () => { tracking = false; reset(); });
}

// The sheets of the planning have their own address: the app can open on them.
registerModal("seance", (id) => {
  const slot = data.model && data.model.slotById(id);
  if (!slot) return false;
  if (currentPage().path === "planning") showPlanningDay(slot.iso);   // the planning shows its day, under the sheet
  openSlotDetails(data.model, slot);
  return true;
});
registerModal("evenement", (id) => {
  if (id === "nouveau") { openEventForm({}); return true; }
  return openEventForm({ eventId: id }) !== false;
});
registerModal("agenda", () => { openExportSheet(); return true; });
registerModal("couleurs", () => (data.model ? (openLegendSheet(data.model), true) : false));
