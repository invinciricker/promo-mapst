/* =====================================================================================
   accueil.js: the first page of the app (mockups 3, 4 and 13). One job: today.

     - A window onto the Baie des Anges, with « Bonjour Sam » (« Bonsoir » from 18:00),
       the date, and a round button with the initial that opens Profil. The picture
       follows the sky of Nice that day (js/core/sun.js); #accueil?ciel=aube (or jour,
       couchant, nuit) forces a sky, to check all four.
     - « Aujourd'hui »: the half-day on now (progress bar, « encore 1 h 20 ») or the
       next one, then the one after; « Fini pour aujourd'hui »; or « Week-end », the
       holiday or the day off, with the next half-day. Today's personal events, and an
       épreuve or a dossier due within 14 days with its J-x (js/planning/today.js).
     - « Réviser »: série and XP, the lesson to continue with its ring, « Continuer ».
   Nothing else.
   ===================================================================================== */

import { esc, icon, ring, setHTML } from "../core/dom.js";
import { capitalize, longDate, clock, duration, parseISO, toISO } from "../core/dates.js";
import { push } from "../core/nav.js";
import { data } from "../core/data.js";
import { firstName, initial } from "../core/user.js";
import { skyAt, SKIES } from "../core/sun.js";
import { todayStatus, dayLabel } from "../planning/today.js";
import { slotLineHTML, countdownChip, placeWho } from "../planning/parts.js";
import { openSlotDetails } from "../planning/details.js";
import { openEventForm } from "../planning/event-form.js";
import { streak, mistakes } from "../reviser/progress.js";
import { statsChips, lessonToContinue, lessonName, startLesson, startReview } from "../reviser/reviser.js";

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

/** The sky to show: the one forced in the address (?ciel=nuit), or the real one. */
function skyFor(now, query) {
  const forced = query.get("ciel");
  return SKIES.includes(forced) ? forced : skyAt(now);
}

/**
 * @param el     the page element
 * @param query  the options of its address (ciel=nuit forces a sky)
 */
export function mountAccueil(el, query = new URLSearchParams()) {
  let forcedQuery = query;

  // ---------------------------------------------------------------------------------
  // The window onto the bay
  // ---------------------------------------------------------------------------------
  function heroHTML(now) {
    const sky = skyFor(now, forcedQuery);
    const name = firstName();
    const hello = `${now.getHours() >= 18 ? "Bonsoir" : "Bonjour"}${name ? ` ${name}` : ""}`;
    const letter = initial(name);
    return `<div class="hero hero--${sky}" data-sky="${sky}">
        <img class="hero__img" src="img/baie-${sky}.svg" alt="" decoding="async">
        <div class="hero__hello"><h1>${esc(hello)}</h1><p>${esc(capitalize(longDate(now)))}</p></div>
        <button type="button" class="hero__me" data-profil aria-label="Profil${name ? ` de ${esc(name)}` : ""}">${letter ? esc(letter) : icon("person", "icon--s")}</button>
      </div>`;
  }

  // ---------------------------------------------------------------------------------
  // « Aujourd'hui »
  // ---------------------------------------------------------------------------------
  function todayHTML(now) {
    const model = data.model;
    if (!model) {
      return `<div class="card today"><div class="today__top">
          <span class="tile-icon tone-galet">${icon("alert", "icon--s")}</span>
          <div><div class="row__title row__title--strong">Planning indisponible</div>
          <div class="small muted">Il n’a pas pu se charger. Vérifie ta connexion.</div></div></div></div>`;
    }
    const st = todayStatus(model, now);
    let top = "";
    let nextPart = "";

    if (st.kind === "now") {
      const x = st.current;
      const pct = Math.max(2, Math.min(100, ((now - x.start) / (x.end - x.start)) * 100));
      const left = (x.end - now) / 60000;
      top = `<div class="today__label"><span class="live-dot cat-${esc(x.item.cat)}" aria-hidden="true"></span>En ce moment</div>
        ${slotLineHTML(x.item, { time: `→ ${clock(x.item.end)}` })}
        <div class="today__progress cat-${esc(x.item.cat)}">
          <span class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="Avancement de la demi-journée"><i style="width:${pct.toFixed(1)}%"></i></span>
          <span class="today__legend"><span>${clock(x.item.start)}</span><b>encore ${duration(left)}</b><span>${clock(x.item.end)}</span></span>
        </div>`;
      if (st.after) nextPart = nextBlock(st.after, now, "Ensuite");
    } else if (st.kind === "next") {
      const x = st.next;
      const wait = (x.start - now) / 60000;
      top = `<div class="today__label">${wait <= 90 ? `Dans ${duration(wait)}` : "Aujourd’hui"}</div>
        ${slotLineHTML(x.item)}`;
      if (st.after) nextPart = nextBlock(st.after, now, "Ensuite");
    } else {
      top = `<div class="today__top">
          <span class="tile-icon tone-${st.off.tone}">${icon(st.off.icon, "icon--s")}</span>
          <div><div class="row__title row__title--strong">${esc(st.off.title)}</div><div class="small muted">${esc(st.off.text)}</div></div>
        </div>`;
      if (st.next) nextPart = nextBlock(st.next, now);
    }

    const personal = st.personal.map((item) => `
        <button type="button" class="slot cat-perso" data-edit-event="${esc(item.eventId)}">
          <span class="slot-bar" aria-hidden="true"></span>
          <span class="row__main"><span class="row__title">${esc(item.title)}</span>
            <span class="row__sub">Perso${placeWho(item) ? `, ${esc(placeWho(item))}` : ""}</span></span>
          <span class="slot__time">${item.start ? esc(clock(item.start)) : "Journée"}</span>
          ${icon("right", "chev")}
        </button>`).join("");

    const deadline = st.deadline ? `
        <div class="today__part">
          <div class="slot slot--static tone-bougainvillier">
            <span class="tile-icon">${icon("flag", "icon--s")}</span>
            <span class="row__main"><span class="row__title">${esc(st.deadline.k.title)}</span>
              <span class="row__sub">${esc(capitalize(longDate(parseISO(st.deadline.k.date))))}</span></span>
            ${countdownChip(st.deadline.k.date, toISO(now))}
          </div>
        </div>` : "";

    return `<section class="card today" aria-label="Aujourd’hui">
        ${top}
        ${personal ? `<div class="today__part"><div class="today__label">Pour toi aujourd’hui</div>${personal}</div>` : ""}
        ${nextPart}
        ${deadline}
      </section>`;
  }

  function nextBlock(x, now, label = "") {
    const day = dayLabel(x.iso, now);
    const title = label && day === "Aujourd’hui" ? label : label ? `${label} · ${day.toLowerCase()}` : day;
    return `<div class="today__part"><div class="today__label">${esc(title)}</div>${slotLineHTML(x.item)}</div>`;
  }

  // ---------------------------------------------------------------------------------
  // « Réviser »
  // ---------------------------------------------------------------------------------
  function reviseHTML(now) {
    const content = data.reviser;
    if (!content || !content.total) {
      return `<section class="card revise"><div class="revise__lesson">
          <span class="tile-icon tile-icon--m tone-turquoise">${icon("clock", "icon--s")}</span>
          <div><div class="row__title row__title--strong">Questions en préparation</div>
          <div class="small muted">Les leçons de Réviser arrivent bientôt.</div></div></div></section>`;
    }
    const s = streak();
    const evening = now.getHours() >= 18 && s.count > 0 && !s.doneToday;
    const chips = statsChips({ nudge: evening ? "Une leçon ce soir pour garder ta série." : "" });
    const next = lessonToContinue();
    if (!next) {
      const errors = mistakes(content);
      return `<section class="card revise">
          <div class="revise__stats">${chips}</div>
          <div class="revise__lesson">
            <span class="tile-icon tile-icon--m tone-turquoise">${icon("check", "icon--s")}</span>
            <div><div class="row__title row__title--strong">Tout est à jour</div>
            <div class="small muted">Toutes les leçons sont faites. Bravo !</div></div>
          </div>
          ${errors.due.length ? `<button type="button" class="btn btn--block btn--soft tone-bougainvillier revise__btn" data-review>${icon("repeat", "icon--s")}Mes erreurs : ${plural(errors.due.length, "question", "questions")}</button>` : ""}
        </section>`;
    }
    const r = next.ring;
    return `<section class="card revise">
        <div class="revise__stats">${chips}</div>
        <div class="revise__lesson tone-${next.theme.tone}">
          ${ring(r.total ? r.answered / r.total : 0, { size: 46, text: `${r.answered}/${r.total}`, label: `${r.answered} questions sur ${r.total}` })}
          <div><div class="row__title row__title--strong">${esc(lessonName(next.lesson))}</div>
          <div class="small muted">${esc(next.theme.title)}, leçon ${next.lesson.number}</div></div>
        </div>
        <button type="button" class="btn btn--primary btn--block revise__btn" data-start="${esc(next.lesson.key)}">${r.verb === "Commencer" ? "Commencer" : "Continuer"}</button>
      </section>`;
  }

  // ---------------------------------------------------------------------------------
  function draw(now = new Date()) {
    setHTML(el, `<div class="page__body accueil">${heroHTML(now)}${todayHTML(now)}${reviseHTML(now)}</div>`);
  }

  el.addEventListener("click", (event) => {
    const t = event.target;
    const slot = t.closest("[data-open-slot]");
    const perso = t.closest("[data-edit-event]");
    const start = t.closest("[data-start]");
    if (t.closest("[data-profil]")) push("accueil/profil");
    else if (slot && data.model) {
      const item = data.model.slotById(slot.dataset.openSlot);
      if (item) openSlotDetails(data.model, item);
    } else if (perso) openEventForm({ eventId: perso.dataset.editEvent });
    else if (start) startLesson(data.reviser.lesson(start.dataset.start));
    else if (t.closest("[data-review]")) startReview();
  });

  // The name changed (welcome, Profil): the greeting follows.
  const onName = () => draw();
  window.addEventListener("prenom-change", onName);

  draw();
  return {
    title: "",
    refresh: () => draw(),
    onShow: () => draw(),
    destroy: () => window.removeEventListener("prenom-change", onName),
    /** Every 30 seconds (app.js), and when the app comes back on screen. */
    tick: (now = new Date()) => draw(now),
    /** The address changed: #accueil?ciel=nuit forces a sky, #accueil the real one again. */
    onQuery(next) {
      forcedQuery = next;
      draw();
    },
  };
}
