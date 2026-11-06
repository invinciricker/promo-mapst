/* =====================================================================================
   parts.js: small pieces of HTML shared by the 4 views of the planning
   (a half-day card, a row, a banner, a countdown, the legend...).
   ===================================================================================== */

import { esc, icon } from "../core/dom.js";
import { at, hour, duration, minutes, parseISO, toISO, daysBetween, countdown, capitalize,
  longDate, shortDate, MONTHS_SHORT, dayMonth } from "../core/dates.js";
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

/** "Cours", "Centre de loisirs"... */
export function kindOf(model, item) {
  if (item.kind === "perso") return item.repeat === "weekly" ? "Perso · chaque semaine"
    : item.repeat === "monthly" ? "Perso · chaque mois" : "Perso";
  return model.category(item.cat).label;
}

/** Place and trainers, with their icons. */
export function metaHTML(item) {
  const parts = [];
  if (item.place) parts.push(`<span>${icon("pin")}${esc(item.place)}</span>`);
  if (item.who) parts.push(`<span>${icon("user")}${esc(item.who)}</span>`);
  return parts.length ? `<span class="meta">${parts.join("")}</span>` : "";
}

/** What to do when the item is tapped (open details, or edit a personal event). */
function actionAttr(item) {
  return item.kind === "perso" ? `data-edit-event="${esc(item.eventId)}"` : `data-open-slot="${esc(item.id)}"`;
}

const checkBadge = () => `<span class="badge badge--warn">${icon("alert")}À vérifier</span>`;

/** A half-day as a big card (Jour view). */
export function slotCard(model, item, now) {
  const st = itemState(item, now);
  const cls = [`slot cat-${item.cat}`, st.now && "slot--now", st.past && "slot--past", item.free && "slot--free"]
    .filter(Boolean).join(" ");
  const time = item.start
    ? `${hour(item.start)}${itemEnd(item) ? `<small>${hour(itemEnd(item))}</small>` : ""}`
    : `Jour<small>entier</small>`;
  const kind = `${esc(kindOf(model, item))}${st.now ? ` <span class="badge badge--solid">En cours</span>` : ""}${item.check ? " " + checkBadge() : ""}`;
  const inner = `
      <span class="slot__time">${time}</span>
      <span class="slot__bar" aria-hidden="true"></span>
      <span class="slot__body">
        <span class="slot__kind">${kind}</span>
        <span class="slot__title">${esc(item.title)}</span>
        ${metaHTML(item)}
        ${item.free && item.note ? `<span class="meta">${esc(item.note)}</span>` : ""}
      </span>`;
  if (item.free) return `<div class="${cls}">${inner}<span></span></div>`;
  return `<button type="button" class="${cls}" ${actionAttr(item)}>${inner}
      <span class="slot__end">${icon("right")}</span></button>`;
}

/** A half-day as a compact row (Semaine view, day under the month). */
export function slotRow(model, item, now) {
  const st = itemState(item, now);
  const cls = [`wrow cat-${item.cat}`, st.past && "wrow--past", item.free && "wrow--free"].filter(Boolean).join(" ");
  const time = item.start
    ? `${hour(item.start)}${itemEnd(item) ? `<small>${hour(itemEnd(item))}</small>` : ""}`
    : `Jour`;
  const meta = [item.place, item.who].filter(Boolean).join(" · ");
  const inner = `
      <span class="wrow__time">${time}</span>
      <span class="wrow__bar" aria-hidden="true"></span>
      <span class="wrow__body">
        <span class="wrow__title">${esc(item.kind === "perso" ? item.title : item.short || item.title)}${st.now ? ` <span class="badge badge--solid">En cours</span>` : ""}</span>
        ${meta ? `<span class="wrow__meta">${esc(meta)}</span>` : ""}
        ${item.check ? `<span>${checkBadge()}</span>` : ""}
      </span>`;
  if (item.free) return `<div class="${cls}">${inner}</div>`;
  return `<button type="button" class="${cls}" ${actionAttr(item)} aria-label="${esc(`${item.start ? hour(item.start) : "Journée"}, ${item.title}`)}">${inner}</button>`;
}

/** Row between two half-days: « Pause déjeuner · 1 h ». */
export function gapRow(previous, next) {
  const gap = minutes(next.start) - minutes(itemEnd(previous));
  if (gap < 30) return "";
  const lunch = minutes(itemEnd(previous)) <= 13 * 60 && minutes(next.start) >= 12 * 60 + 30;
  return `<div class="gap-row">${icon(lunch ? "coffee" : "clock")}${lunch ? "Pause déjeuner" : "Pause"} · ${duration(gap)}</div>`;
}

/** The list of a day: cards (Jour) or rows (Semaine), with the pauses in between. */
export function dayItemsHTML(model, iso, now, { compact = false } = {}) {
  const items = itemsOfDay(model, iso);
  let html = "";
  let previous = null;
  for (const item of items) {
    if (!compact && previous && previous.start && item.start) html += gapRow(previous, item);
    html += compact ? slotRow(model, item, now) : slotCard(model, item, now);
    if (item.start) previous = item;
  }
  return { html, count: items.length };
}

/** Coloured banners at the top of a day: public holiday, holidays, key dates. */
export function dayBanners(model, iso, todayIso) {
  const day = model.day(iso);
  let html = "";
  if (day.holiday) {
    html += banner("libre", "sun", "Férié", `${day.holiday} · pas de formation`, true);
  } else if (day.vacation) {
    html += banner("libre", "sun", "Vacances", `${day.vacation} · pas de formation`, true);
  }
  for (const k of day.keyDates) {
    if (k.kind === "conge") continue;                         // already shown above
    if (k.end && k.date !== iso && k.kind !== "epreuve") continue; // periods: first day only
    const left = daysBetween(parseISO(todayIso), parseISO(k.date));
    const parts = [];
    if (left >= 0) parts.push(countdown(left));
    if (k.end) parts.push(`jusqu’au ${dayMonth(parseISO(k.end))}`);
    if (k.note) parts.push(k.note);
    const iconName = k.kind === "dossier" ? "flag" : k.kind === "epreuve" ? "award" : "layers";
    html += banner(k.cat, iconName, k.title, parts.join(" · "));
  }
  return html;
}

function banner(cat, iconName, title, text, off = false) {
  return `<div class="banner cat-${cat}${off ? " banner--off" : ""}">
      <span class="banner__icon">${icon(iconName)}</span>
      <div class="banner__body"><p class="banner__title">${esc(title)}</p>${text ? `<p class="banner__text">${esc(text)}</p>` : ""}</div>
    </div>`;
}

/** Countdown chip: « J-12 » (filled colour when it is within a week). */
export function countdownChip(dateIso, todayIso) {
  const left = daysBetween(parseISO(todayIso), parseISO(dateIso));
  return `<span class="countdown${left >= 0 && left <= 7 ? " countdown--soon" : ""}">${esc(countdown(left))}</span>`;
}

/** One important date in a list. */
export function keyDateRow(k, todayIso) {
  const d = parseISO(k.date);
  const past = (k.end || k.date) < todayIso;
  const ongoing = !past && k.date < todayIso;
  const sub = [capitalize(shortDate(d)) + (k.end ? ` → ${shortDate(parseISO(k.end))}` : "")];
  if (k.note) sub.push("à confirmer");
  const chip = past ? `<span class="countdown">Passé</span>`
    : ongoing ? `<span class="countdown countdown--soon">En cours</span>` : countdownChip(k.date, todayIso);
  return `<button type="button" class="kdate cat-${esc(k.cat)}${past ? " kdate--past" : ""}" data-goto-day="${esc(k.date)}">
      <span class="kdate__date"><span class="kdate__day">${d.getDate()}</span><span class="kdate__month">${esc(MONTHS_SHORT[d.getMonth()].replace(".", ""))}</span></span>
      <span class="kdate__body"><span class="kdate__title">${esc(k.title)}</span><br><span class="kdate__sub">${esc(sub.join(" · "))}</span></span>
      ${chip}
    </button>`;
}

/** The colour legend. */
export function legendHTML(model) {
  const items = ["cours", "prepa", "centre", "epreuve", "libre", "perso"].map((id) => {
    const c = model.category(id);
    return `<span class="legend__item cat-${id}"><span class="pebble" aria-hidden="true"></span><span><b>${esc(c.name)}</b> · ${esc(c.label.toLowerCase())}</span></span>`;
  });
  items.push(`<span class="legend__item"><span class="legend__school" aria-hidden="true"></span><span>Vacances scolaires</span></span>`);
  items.push(`<span class="legend__item cat-epreuve"><span class="legend__dot" aria-hidden="true"></span><span>Épreuve, dossier</span></span>`);
  return `<div class="card legend">${items.join("")}</div>`;
}

/** Text of the line under the date: « Semaine 8 sur 36 · MSP 1 · Ville de Nice » */
export function contextLine(model, iso) {
  const day = model.day(iso);
  const parts = [];
  if (day.week) parts.push(`Semaine ${day.week} sur ${model.totalWeeks}`);
  if (day.stage) parts.push(day.stage.title);
  return { text: parts.join(" · "), cat: day.stage ? day.stage.cat : null };
}

/** « Vendredi 6 novembre » */
export const dayTitle = (iso) => capitalize(longDate(parseISO(iso)));
