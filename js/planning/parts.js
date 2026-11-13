/* =====================================================================================
   parts.js: small pieces of HTML shared by the planning and Accueil
   (a half-day row, the list of a day, a key date, a countdown, the colour legend...).
   ===================================================================================== */

import { esc, icon } from "../core/dom.js";
import { at, clock, duration, minutes, parseISO, toISO, addDays, daysBetween, countdown, capitalize,
  longDate, MONTHS_SHORT, dayMonth } from "../core/dates.js";
import { openSheet } from "../core/sheet.js";
import { personalOn } from "./personal.js";

/** Class half-days + personal events of a day, in time order. */
export function itemsOfDay(model, iso) {
  const day = model.day(iso);
  const items = day.slots.concat(personalOn(iso));
  return items.sort((a, b) => sortKey(a) - sortKey(b));
}
const sortKey = (item) => (item.start ? minutes(item.start) : -1);

/** End time of an item (a personal event without end lasts one hour). */
export function itemEnd(item) {
  if (item.end) return item.end;
  if (!item.start) return null;
  const m = Math.min(minutes(item.start) + 60, 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Is the item happening right now / already over? */
export function itemState(item, now) {
  if (!item.start) return { now: false, past: item.iso < toISO(now) };
  const start = at(item.iso, item.start);
  const end = at(item.iso, itemEnd(item));
  return { now: now >= start && now < end, past: end <= now };
}

/** "Cours", "Ville de Nice", "Perso"... */
export function kindOf(model, item) {
  if (item.kind === "perso") return item.repeat === "weekly" ? "Perso · chaque semaine"
    : item.repeat === "monthly" ? "Perso · chaque mois" : "Perso";
  return model.category(item.cat).label;
}

/** « Structures AnimaNice, Ville de Nice »: where, and with whom. */
export function placeWho(item) {
  return [item.place, item.who].filter(Boolean).join(", ");
}

/** What a tap on the item does: details of a half-day, or the form of a personal event. */
export function actionAttr(item) {
  return item.kind === "perso" ? `data-edit-event="${esc(item.eventId)}"` : `data-open-slot="${esc(item.id)}"`;
}

export const checkTag = () => `<span class="tag tone-citron">À vérifier</span>`;

/** The small « Couleurs » chip (Mois and Année) that opens the colour legend. */
export const legendButton = () => `<button type="button" class="chip chip--s pl-legend-btn tap" data-legend>${icon("swatch", "icon--xs")}Couleurs</button>`;

/**
 * A half-day as a card (Planning): hours on the left, the colour bar, the title and
 * where, and › when it opens. The one that is on now says « En cours », how long is
 * left, and shows a thin progress bar.
 */
export function slotRowHTML(model, item, now) {
  const st = itemState(item, now);
  const end = itemEnd(item);
  const time = item.start
    ? `${clock(item.start)}${end ? `<span>${clock(end)}</span>` : ""}`
    : `Jour<span>entier</span>`;
  let sub = item.free ? (item.note || "") : placeWho(item);
  let bar = "";
  if (st.now && end) {
    const start = at(item.iso, item.start);
    const stop = at(item.iso, end);
    const pct = Math.max(2, Math.min(100, ((now - start) / (stop - start)) * 100));
    sub = [item.place || sub, `encore ${duration((stop - now) / 60000)}`].filter(Boolean).join(", ");
    bar = `<span class="slot__bar"><i style="width:${pct.toFixed(1)}%"></i></span>`;
  }
  const inner = `
      <span class="slot__when">${time}</span>
      <span class="slot-bar" aria-hidden="true"></span>
      <span class="row__main">
        <span class="row__title">${esc(item.title)}${st.now ? ` <span class="tag">En cours</span>` : ""}${item.check ? " " + checkTag() : ""}</span>
        ${sub ? `<span class="row__sub">${esc(sub)}</span>` : ""}
        ${bar}
      </span>`;
  const cls = `slot pl-row cat-${esc(item.cat)}${st.now ? " is-now" : ""}${st.past ? " is-past" : ""}${item.free ? " is-free" : ""}`;
  if (item.free) return `<div class="${cls}">${inner}</div>`;
  return `<button type="button" class="${cls} tap" ${actionAttr(item)}>${inner}${icon("right", "chev")}</button>`;
}

/** Days off and important dates of a day, as lines above its half-days. */
export function dayNotesHTML(model, iso, todayIso) {
  const day = model.day(iso);
  let html = "";
  if (day.holiday) html += noteLine("libre", "sun", `${day.holiday}, férié`, "Pas de formation");
  else if (day.vacation) html += noteLine("libre", "sun", day.vacation, "Pas de formation");
  for (const k of day.keyDates) {
    if (k.kind === "conge") continue;                         // already said above
    if (k.end && k.date !== iso && k.kind !== "epreuve") continue; // periods: first day only
    const left = daysBetween(parseISO(todayIso), parseISO(k.date));
    const parts = [];
    if (k.end) parts.push(`Jusqu’au ${dayMonth(parseISO(k.end))}`);
    if (k.note) parts.push("À confirmer");
    const iconName = k.kind === "dossier" || k.kind === "epreuve" ? "flag" : "cal";
    html += noteLine(k.cat, iconName, k.title, parts.join(" · "),
      (k.kind === "epreuve" || k.kind === "dossier") && left >= 0 ? countdownChip(k.date, todayIso) : "");
  }
  return html;
}

function noteLine(cat, iconName, title, text, end = "") {
  return `<div class="row pl-note cat-${esc(cat)}">
      <span class="tile-icon">${icon(iconName, "icon--s")}</span>
      <span class="row__main"><span class="row__title">${esc(title)}</span>${text ? `<span class="row__sub">${esc(text)}</span>` : ""}</span>
      ${end}
    </div>`;
}

/**
 * The list of a day (Semaine and Mois): its notes, then its half-days and personal events
 * as cards. A day without class says so in one card, with a link to the next class day.
 */
export function dayListHTML(model, iso, now) {
  const todayIso = toISO(now);
  const notes = dayNotesHTML(model, iso, todayIso);
  const rows = itemsOfDay(model, iso).map((item) => slotRowHTML(model, item, now)).join("");
  if (rows || notes) {
    return `<div class="pl-day">${notes ? `<div class="list pl-notes">${notes}</div>` : ""}${rows ? `<div class="slots">${rows}</div>` : ""}</div>`;
  }
  const next = nextClassDay(model, iso);
  return `<div class="card pl-empty"><p>${[0, 6].includes(parseISO(iso).getDay()) ? "Week-end, pas de formation." : "Pas de formation ce jour-là."}</p>
      ${next ? `<button type="button" class="pl-empty__link tap" data-select-day="${next}">Prochain cours : ${esc(longDate(parseISO(next)))}${icon("right", "icon--xs")}</button>` : ""}</div>`;
}

/** The next day (after iso) with a class half-day, or null. */
export function nextClassDay(model, iso) {
  let d = addDays(parseISO(iso), 1);
  for (let i = 0; i < 200 && model.inRange(d); i++, d = addDays(d, 1)) {
    if (model.day(toISO(d)).slots.some((s) => !s.free)) return toISO(d);
  }
  return null;
}

/** Countdown chip: « J-12 » (or « Demain », « Aujourd’hui »). */
export function countdownChip(dateIso, todayIso) {
  const left = daysBetween(parseISO(todayIso), parseISO(dateIso));
  return `<span class="chip chip--s tone-bougainvillier num">${esc(countdown(left).replace("J-", "J‑"))}</span>`;
}

/** One important date, for the « Dates clés » page. */
export function keyDateRowHTML(k, todayIso) {
  const d = parseISO(k.date);
  const past = (k.end || k.date) < todayIso;
  const ongoing = !past && k.date < todayIso;
  const exam = k.kind === "epreuve" || k.kind === "dossier";
  const sub = [];
  if (k.end) sub.push(`Jusqu’au ${longDate(parseISO(k.end)).replace(/^\S+ /, "")}`);
  const end = past ? "" : ongoing ? `<span class="chip chip--s tone-turquoise">En cours</span>`
    : exam ? countdownChip(k.date, todayIso) : "";
  // « Retour au CAL : environnement, puis APEN » -> « Retour au CAL » and, under it, the rest.
  const cut = k.title.indexOf(" : ");
  const title = cut > 0 ? k.title.slice(0, cut) : k.title;
  if (cut > 0) sub.unshift(capitalize(k.title.slice(cut + 3)));
  return `<button type="button" class="row kd-row cat-${esc(k.cat)}${past ? " is-past" : ""}" data-goto-day="${esc(k.date)}">
      <span class="datebox"><b>${d.getDate()}</b><small>${esc(MONTHS_SHORT[d.getMonth()])}</small></span>
      <span class="row__main"><span class="row__title">${esc(title)}</span>
        ${sub.length || k.note ? `<span class="row__sub">${esc(sub.join(" · "))}${k.note ? `${sub.length ? " " : ""}<span class="tag tone-citron">À confirmer</span>` : ""}</span>` : ""}</span>
      ${end}
    </button>`;
}

/** The colour legend, in a sheet (button « Couleurs »). */
export function openLegendSheet(model) {
  const rows = ["cours", "prepa", "centre", "epreuve", "libre", "perso"].map((id) => {
    const c = model.category(id);
    return `<div class="row row--top cat-${id}"><span class="legend-dot" aria-hidden="true"></span>
        <span class="row__main"><span class="row__title">${esc(c.name)} · ${esc(c.label)}</span><span class="row__sub">${esc(c.desc)}</span></span></div>`;
  }).join("");
  openSheet({
    title: "Couleurs",
    address: "couleurs",
    body: `<p class="sheet-text">Chaque demi-journée a la couleur de son activité. Les noms viennent de Nice.</p>
      <div class="list">${rows}</div>
      <p class="sheet-hint" style="margin-top:0">Dans la semaine, deux petites barres sous chaque jour : le matin et l’après-midi. Dans le mois, un petit point rose : une épreuve ou un dossier.</p>`,
  });
}

/** « Vendredi 6 novembre » */
export const dayTitle = (iso) => capitalize(longDate(parseISO(iso)));
