/* =====================================================================================
   planning.js: the Planning tab. It puts the pieces together:
     - the « En ce moment » card (now-card.js)
     - the Jour / Semaine / Mois / Année switch, the arrows and the « Aujourd’hui » button
     - the view itself (view-day.js, view-week.js, view-month.js, view-year.js)
     - what comes under it (important dates, legend, stages of the year...)
     - the « + » button (event-form.js) and the calendar export (export.js)
   Swipe left or right on the view to move, or use the arrows (also the keyboard arrows).
   ===================================================================================== */

import { $, $$, esc, icon, setHTML } from "../core/dom.js";
import { load, save } from "../core/storage.js";
import { parseISO, toISO, addDays, addMonths, startOfWeek, startOfMonth, capitalize,
  dayMonth, MONTHS } from "../core/dates.js";
import { footerHTML } from "../core/texts.js";
import { hasOpenSheet } from "../core/sheet.js";
import { onPersonalChange, personalOn } from "./personal.js";
import { nowCardHTML } from "./now-card.js";
import { dayViewHTML } from "./view-day.js";
import { weekViewHTML } from "./view-week.js";
import { monthViewHTML } from "./view-month.js";
import { yearViewHTML } from "./view-year.js";
import { legendHTML, keyDateRow, dayBanners, dayItemsHTML, contextLine, dayTitle } from "./parts.js";
import { openSlotDetails } from "./details.js";
import { openEventForm } from "./event-form.js";
import { openExportSheet } from "./export.js";
import { shouldShowInstallHint, installHintHTML, dismissInstallHint, openInstallSheet } from "../screens/install.js";

const VIEWS = [
  { id: "jour", label: "Jour" },
  { id: "semaine", label: "Semaine" },
  { id: "mois", label: "Mois" },
  { id: "annee", label: "Année" },
];

/**
 * Builds the Planning tab inside `container`.
 * onTheme(mode, themeId) is called by « Réviser ce thème » / « Étudier ce thème ».
 * Returns { refresh, tick }: app.js calls tick() every 30 seconds.
 */
export function mountPlanning(container, model, { onTheme }) {
  const start = new Date();
  const savedView = load("planning-view", "jour");
  const state = {
    view: VIEWS.some((v) => v.id === savedView) ? savedView : "jour",
    date: model.clamp(new Date(start.getFullYear(), start.getMonth(), start.getDate())),  // opens on today
    selected: toISO(start),     // day chosen in the Mois view
    today: toISO(start),
    signature: "",
  };

  setHTML(container, `
    <div class="wrap screen__body">
      <div id="pl-now"></div>
      <div id="pl-install"></div>
      <div class="pl-controls">
        <div class="segmented" role="radiogroup" aria-label="Affichage du planning">
          <span class="segmented__thumb" aria-hidden="true"></span>
          ${VIEWS.map((v) => `<button type="button" class="segmented__btn" role="radio" aria-checked="false" data-view="${v.id}">${v.label}</button>`).join("")}
        </div>
        <div class="pl-nav">
          <button type="button" class="icon-btn" data-step="-1" aria-label="Précédent">${icon("left")}</button>
          <div class="pl-nav__center" aria-live="polite">
            <p class="pl-nav__title"></p>
            <p class="pl-nav__sub"></p>
          </div>
          <button type="button" class="icon-btn" data-step="1" aria-label="Suivant">${icon("right")}</button>
        </div>
      </div>
      <div class="pl-view" id="pl-view"></div>
      <div class="screen__part" id="pl-after"></div>
      <button type="button" class="card export-card" data-export>
        <span class="export-card__icon">${icon("export")}</span>
        <span class="export-card__body">
          <span class="export-card__title">Ajouter à ton agenda</span>
          <span class="export-card__text">Google Agenda, Calendrier d’Apple… (fichier .ics)</span>
        </span>
        ${icon("right")}
      </button>
      ${footerHTML()}
    </div>
    <button type="button" class="fab" data-add-event aria-label="Ajouter un événement perso">${icon("plus")}</button>
    <button type="button" class="today-pill is-hidden" data-today>${icon("today")}Aujourd’hui</button>`);

  const el = {
    now: $("#pl-now", container),
    install: $("#pl-install", container),
    view: $("#pl-view", container),
    after: $("#pl-after", container),
    title: $(".pl-nav__title", container),
    sub: $(".pl-nav__sub", container),
    prev: $('[data-step="-1"]', container),
    next: $('[data-step="1"]', container),
    thumb: $(".segmented__thumb", container),
    todayPill: $("[data-today]", container),
  };

  // ---------------------------------------------------------------------------------
  // Moving in time
  // ---------------------------------------------------------------------------------
  const isWeekendEmpty = (date) => {
    const iso = toISO(date);
    return (date.getDay() === 0 || date.getDay() === 6) && !model.day(iso).slots.length && !personalOn(iso).length;
  };

  /** The date reached by one step (-1 or +1) in the current view. */
  function stepDate(dir) {
    if (state.view === "jour") {
      let d = addDays(state.date, dir);
      for (let i = 0; i < 2 && isWeekendEmpty(d); i++) d = addDays(d, dir);   // skip empty weekends
      return d;
    }
    if (state.view === "semaine") return addDays(startOfWeek(state.date), 7 * dir);
    if (state.view === "mois") return addMonths(startOfMonth(state.date), dir);
    return state.date;
  }

  function canStep(dir) {
    if (state.view === "annee") return false;
    const d = stepDate(dir);
    if (state.view === "semaine") return addDays(d, 4) >= model.firstDay && d <= model.lastDay;
    return model.inRange(d);
  }

  function step(dir) {
    if (!canStep(dir)) return;
    state.date = stepDate(dir);
    if (state.view === "mois") state.selected = defaultSelected(state.date);
    render(dir);
  }

  /** In the Mois view: today if it is in the month, else the first day with something. */
  function defaultSelected(monthDate) {
    const first = startOfMonth(monthDate);
    if (state.today.slice(0, 7) === toISO(first).slice(0, 7)) return state.today;
    for (let d = first; d.getMonth() === first.getMonth(); d = addDays(d, 1)) {
      if (model.mainCategory(toISO(d), personalOn(toISO(d)).length)) return toISO(d);
    }
    return toISO(first);
  }

  function goToday() {
    const before = state.date;
    state.date = model.clamp(parseISO(state.today));
    state.selected = state.today;
    render(state.date > before ? 1 : state.date < before ? -1 : 0);
  }

  /** Changes the view (and the date, if one is given). */
  function setView(view, date = null) {
    if (date) state.date = model.clamp(date);
    state.view = view;
    if (view === "mois") {
      const iso = toISO(state.date);
      state.selected = date && date.getDate() !== 1 ? iso : defaultSelected(state.date);
    }
    save("planning-view", view);
    render(0);
  }

  /** Is the current view showing today? (to hide the « Aujourd’hui » button) */
  function showsToday() {
    const today = parseISO(state.today);
    if (state.view === "jour") return toISO(state.date) === state.today;
    if (state.view === "semaine") return toISO(startOfWeek(state.date)) === toISO(startOfWeek(today));
    if (state.view === "mois") return toISO(state.date).slice(0, 7) === state.today.slice(0, 7);
    return true;
  }

  // ---------------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------------
  function navText() {
    const iso = toISO(state.date);
    if (state.view === "jour") {
      const ctx = contextLine(model, iso);
      const day = model.day(iso);
      const fallback = day.holiday ? "Jour férié" : day.vacation || "";
      return { title: dayTitle(iso), sub: ctx.text || fallback, cat: ctx.cat };
    }
    if (state.view === "semaine") {
      const monday = startOfWeek(state.date);
      const friday = addDays(monday, 4);
      const title = monday.getMonth() === friday.getMonth()
        ? `${monday.getDate()} → ${friday.getDate()} ${MONTHS[friday.getMonth()]}`
        : `${dayMonth(monday)} → ${dayMonth(friday)}`;
      // Context: the first weekday of the week that has one
      for (let i = 0; i < 5; i++) {
        const dIso = toISO(addDays(monday, i));
        const ctx = contextLine(model, dIso);
        if (ctx.text) return { title, sub: ctx.text, cat: ctx.cat };
      }
      const day = model.day(toISO(monday));
      return { title, sub: day.vacation || "Pas de formation", cat: null };
    }
    if (state.view === "mois") {
      const first = startOfMonth(state.date);
      let count = 0;
      for (let d = first; d.getMonth() === first.getMonth(); d = addDays(d, 1)) {
        const cat = model.mainCategory(toISO(d));
        if (cat && cat !== "libre") count += 1;
      }
      return { title: `${capitalize(MONTHS[first.getMonth()])} ${first.getFullYear()}`, sub: `${count} jours de formation`, cat: null };
    }
    return {
      title: `${model.seasonStart.getFullYear()} – ${model.seasonEnd.getFullYear()}`,
      sub: `${dayMonth(model.seasonStart)} → ${dayMonth(model.seasonEnd)} · ${model.totalWeeks} semaines`,
      cat: null,
    };
  }

  function renderControls() {
    const index = VIEWS.findIndex((v) => v.id === state.view);
    $$(".segmented__btn", container).forEach((b) => b.setAttribute("aria-checked", String(b.dataset.view === state.view)));
    el.thumb.style.width = `calc((100% - 6px) / ${VIEWS.length})`;
    el.thumb.style.transform = `translateX(${index * 100}%)`;

    const nav = navText();
    const today = state.view !== "annee" && showsToday() && state.view === "jour";
    setHTML(el.title, `${esc(nav.title)}${today ? ` <span class="today-dot" title="Aujourd’hui"></span>` : ""}`);
    setHTML(el.sub, nav.sub ? `${nav.cat ? `<span class="pebble cat-${esc(nav.cat)}" aria-hidden="true"></span>` : ""}${esc(nav.sub)}` : "&nbsp;");

    const arrows = state.view !== "annee";
    el.prev.style.visibility = arrows ? "" : "hidden";
    el.next.style.visibility = arrows ? "" : "hidden";
    el.prev.disabled = !canStep(-1);
    el.next.disabled = !canStep(1);
    el.todayPill.classList.toggle("is-hidden", showsToday());
  }

  function renderNow(now = new Date()) {
    setHTML(el.now, nowCardHTML(model, now));
  }

  function renderInstall() {
    const show = shouldShowInstallHint();
    setHTML(el.install, show ? installHintHTML() : "");
    el.install.hidden = !show;
  }

  function renderView(direction, now = new Date()) {
    const iso = toISO(state.date);
    let html = "";
    if (state.view === "jour") html = dayViewHTML(model, iso, now);
    else if (state.view === "semaine") html = weekViewHTML(model, iso, now);
    else if (state.view === "mois") html = monthViewHTML(model, iso, state.selected, now);
    else html = yearViewHTML(model, now);
    setHTML(el.view, html);
    if (direction !== null) animate(el.view, direction);
  }

  function renderAfter(now = new Date()) {
    const today = state.today;
    let html = "";

    if (state.view === "jour" || state.view === "semaine") {
      const next = model.upcomingDeadlines(today, 3);
      if (next.length) {
        html += `<section class="section">
            <div class="section__head"><h2 class="section__title">À venir</h2>
              <button type="button" class="btn btn--plain btn--small" data-view="annee">Toutes les dates${icon("right", "icon--s")}</button></div>
            <div class="list">${next.map((k) => keyDateRow(k, today)).join("")}</div>
          </section>`;
      }
    }

    if (state.view === "mois") {
      const sel = state.selected;
      const banners = dayBanners(model, sel, today);
      const { html: rows, count } = dayItemsHTML(model, sel, now, { compact: true });
      html += `<section class="section" id="pl-selected">
          <div class="section__head"><h2 class="section__title">${esc(dayTitle(sel))}</h2>
            <button type="button" class="btn btn--plain btn--small" data-goto-day="${sel}">Ouvrir${icon("right", "icon--s")}</button></div>
          ${banners}
          ${count ? `<div class="wday__list">${rows}</div>` : banners ? "" : `<div class="card empty"><p>Rien de prévu ce jour-là.</p></div>`}
        </section>`;
      html += legendHTML(model);
      const month = toISO(state.date).slice(0, 7);
      const inMonth = model.keyDates.filter((k) => k.date.slice(0, 7) === month);
      if (inMonth.length) {
        html += `<section class="section"><div class="section__head"><h2 class="section__title">Ce mois-ci</h2></div>
            <div class="list">${inMonth.map((k) => keyDateRow(k, today)).join("")}</div></section>`;
      }
    }

    if (state.view === "annee") {
      html += legendHTML(model);
      html += stagesHTML(today);
      html += keyDatesHTML(today);
      html += checksHTML();
    }
    setHTML(el.after, html);
  }

  function stagesHTML(today) {
    const rows = model.stages.map((s) => {
      const past = s.end < today;
      const current = s.start <= today && today <= s.end;
      return `<button type="button" class="stage cat-${esc(s.cat)}${past ? " stage--past" : ""}${current ? " stage--current" : ""}" data-goto-week="${esc(s.start)}">
          <span class="stage__dot" aria-hidden="true"></span>
          <span>
            <span class="stage__dates">${esc(dayMonth(parseISO(s.start)))} → ${esc(dayMonth(parseISO(s.end)))}</span>
            <span class="stage__title">${esc(s.title)}${current ? ` <span class="badge badge--cat">En cours</span>` : ""}</span>
            <span class="stage__text">${esc(s.text)}</span>
          </span>
        </button>`;
    }).join("");
    return `<section class="section"><div class="section__head"><h2 class="section__title">Les étapes de l’année</h2>
        <span class="section__aside">${esc(dayMonth(model.seasonStart))} → ${esc(dayMonth(model.seasonEnd))}</span></div>
        <div class="card stages">${rows}</div></section>`;
  }

  function keyDatesHTML(today) {
    const upcoming = model.keyDates.filter((k) => (k.end || k.date) >= today);
    const past = model.keyDates.filter((k) => (k.end || k.date) < today);
    const exams = upcoming.filter((k) => k.kind === "epreuve" || k.kind === "dossier").length;
    return `<section class="section"><div class="section__head"><h2 class="section__title">Dates importantes</h2>
        <span class="section__aside">${exams} épreuves et dossiers à venir</span></div>
        ${upcoming.length ? `<div class="list">${upcoming.map((k) => keyDateRow(k, today)).join("")}</div>` : ""}
        ${past.length ? `<details class="more"><summary>${icon("right")}Déjà passées (${past.length})</summary>
          <div class="list">${past.map((k) => keyDateRow(k, today)).join("")}</div></details>` : ""}
      </section>`;
  }

  function checksHTML() {
    if (!model.checks.length) return "";
    return `<section class="section"><div class="section__head"><h2 class="section__title">À vérifier</h2>
        <span class="section__aside">${model.checks.length} points</span></div>
        <div class="list">${model.checks.map((c) => `
          <div class="list__row">
            <span class="list__icon" style="--soft:var(--warn-soft);--ink:var(--warn-ink)">${icon("alert")}</span>
            <div class="list__body"><p class="list__title">${esc(c.title)}</p><p class="list__text">${esc(c.text)}</p></div>
          </div>`).join("")}</div></section>`;
  }

  /**
   * Draws the controls, the view and what is under it.
   * direction: 1 slides in from the right, -1 from the left, 0 fades in, null: no animation.
   */
  function render(direction = 0, now = new Date()) {
    renderControls();
    renderView(direction, now);
    renderAfter(now);
  }

  function animate(node, direction) {
    node.classList.remove("anim-from-right", "anim-from-left", "anim-fade-up");
    void node.offsetWidth;       // restarts the animation
    node.classList.add(direction > 0 ? "anim-from-right" : direction < 0 ? "anim-from-left" : "anim-fade-up");
  }

  /** What is happening / next (read on the card): when it changes, the view is redrawn. */
  function signature() {
    const card = el.now.firstElementChild;
    return card ? (card.dataset.openSlot || card.dataset.editEvent || "") + card.className : "";
  }

  // ---------------------------------------------------------------------------------
  // Taps and keys
  // ---------------------------------------------------------------------------------
  container.addEventListener("click", (event) => {
    const t = event.target.closest(
      "[data-view],[data-step],[data-today],[data-open-slot],[data-edit-event],[data-add-event],[data-select-day],[data-goto-day],[data-goto-week],[data-goto-month],[data-export],[data-install],[data-install-dismiss]");
    if (!t) return;
    const d = t.dataset;
    if (d.view) setView(d.view);
    else if (d.step) step(Number(d.step));
    else if ("today" in d) goToday();
    else if (d.openSlot) {
      const slot = model.slotById(d.openSlot);
      if (slot) openSlotDetails(model, slot, { onTheme });
    } else if (d.editEvent) openEventForm({ eventId: d.editEvent });
    else if ("addEvent" in d) openEventForm({ date: newEventDate() });
    else if (d.selectDay) {
      state.selected = d.selectDay;
      renderView(null);
      renderAfter();
      const box = $("#pl-selected", container);
      if (box && box.getBoundingClientRect().top > window.innerHeight * 0.7) box.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (d.gotoDay) {
      setView("jour", parseISO(d.gotoDay));
      scrollToControls();
    } else if (d.gotoWeek) {
      setView("semaine", parseISO(d.gotoWeek));
      scrollToControls();
    } else if (d.gotoMonth) {
      setView("mois", parseISO(d.gotoMonth));
      scrollToControls();
    } else if ("export" in d) openExportSheet();
    else if ("install" in d) openInstallSheet();
    else if ("installDismiss" in d) { dismissInstallHint(); renderInstall(); }
  });

  // The « En ce moment » card works with the keyboard too.
  container.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches(".now[role=button]")) {
      event.preventDefault();
      event.target.click();
    }
  });

  // Keyboard arrows (on a laptop) move in time.
  document.addEventListener("keydown", (event) => {
    if (container.hidden || hasOpenSheet() || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest("input, textarea, select, [role=radiogroup]")) return;
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  });

  /** After jumping to another view from far down the page, bring the switch into sight. */
  function scrollToControls() {
    const controls = $(".pl-controls", container);
    if (controls.getBoundingClientRect().top < 0) controls.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function newEventDate() {
    if (state.view === "mois") return state.selected;
    const iso = toISO(state.date);
    if (state.view === "jour" && iso >= state.today) return iso;
    return state.today;
  }

  // Swipe left / right on the view.
  enableSwipe(el.view, () => state.view !== "annee", step);

  // The « + » button slides away while you scroll down, and comes back when you scroll up.
  const fab = $(".fab", container);
  let lastY = window.scrollY;
  window.addEventListener("scroll", () => {
    if (container.hidden) return;
    const y = window.scrollY;
    if (Math.abs(y - lastY) < 6) return;
    fab.classList.toggle("is-tucked", y > lastY && y > 160);
    lastY = y;
  }, { passive: true });

  // Personal events changed: redraw.
  onPersonalChange(() => { renderNow(); render(null); });

  // First drawing
  renderNow();
  renderInstall();
  render(null);
  state.signature = signature();

  return {
    /** Redraw everything (no animation). */
    refresh() { renderNow(); renderInstall(); render(null); },

    /** A newer planning was published: use it. */
    setModel(next) { model = next; renderNow(); render(null); },

    /** Called every 30 seconds by app.js. */
    tick(now = new Date()) {
      const todayIso = toISO(now);
      if (todayIso !== state.today) {
        // A new day: if we were looking at today, follow it.
        const wasToday = showsToday();
        state.today = todayIso;
        if (wasToday) { state.date = model.clamp(parseISO(todayIso)); state.selected = todayIso; }
        renderNow(now);
        render(null, now);
        return;
      }
      renderNow(now);
      const sig = signature();
      if (sig !== state.signature) { state.signature = sig; renderView(null, now); renderAfter(now); }
    },
  };
}

/** Horizontal swipe on an element: calls onStep(+1) to go forward, onStep(-1) back. */
function enableSwipe(node, isEnabled, onStep) {
  let x0 = 0, y0 = 0, dx = 0, tracking = false, horizontal = null;
  const reset = () => { node.classList.remove("is-dragging"); node.style.transform = ""; };

  node.addEventListener("touchstart", (event) => {
    if (!isEnabled() || event.touches.length !== 1) return;
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
      node.classList.add("is-dragging");
      node.style.transform = `translateX(${dx * 0.35}px)`;   // follows the finger, a bit slower
    }
  }, { passive: true });

  node.addEventListener("touchend", () => {
    if (!tracking) return;
    tracking = false;
    reset();
    if (horizontal && Math.abs(dx) > 60) onStep(dx < 0 ? 1 : -1);
  });
  node.addEventListener("touchcancel", () => { tracking = false; reset(); });
}
