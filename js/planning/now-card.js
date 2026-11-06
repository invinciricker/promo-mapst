/* =====================================================================================
   now-card.js: the card at the top of the Planning tab.
     - something is happening: « En ce moment », a progress bar and « encore 1 h 20 »;
     - otherwise: what comes next, with a countdown (« dans 2 h 15 », « Lundi 9 nov. »).
   ===================================================================================== */

import { esc, icon } from "../core/dom.js";
import { at, hour, duration, addDays, toISO, daysBetween, DAYS, MONTHS_SHORT, capitalize,
  dayNumber, MONTHS } from "../core/dates.js";
import { personalOn } from "./personal.js";
import { itemEnd, metaHTML, kindOf } from "./parts.js";

/** Everything that has a time, from yesterday to 3 months ahead, in order. */
function timeline(model, now) {
  const out = [];
  const first = addDays(now, -1);
  for (let i = 0; i <= 92; i++) {
    const iso = toISO(addDays(first, i));
    const items = model.day(iso).slots.concat(personalOn(iso));
    for (const item of items) {
      if (!item.start) continue;
      out.push({ item, iso, start: at(iso, item.start), end: at(iso, itemEnd(item)) });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** « lundi 9h », « demain 9h », « 13h » */
function whenShort(entry, now) {
  const days = daysBetween(now, entry.start);
  const time = hour(entry.item.start);
  if (days === 0) return time;
  if (days === 1) return `demain ${time}`;
  if (days < 7) return `${DAYS[entry.start.getDay()]} ${time}`;
  return `${entry.start.getDate()} ${MONTHS_SHORT[entry.start.getMonth()]} ${time}`;
}

function attrs(item) {
  return item.kind === "perso"
    ? `data-edit-event="${esc(item.eventId)}"`
    : `data-open-slot="${esc(item.id)}"`;
}

export function nowCardHTML(model, now) {
  const todayIso = toISO(now);
  const today = model.day(todayIso);
  const all = timeline(model, now);
  const real = all.filter((x) => !x.item.free);
  const current = real.find((x) => now >= x.start && now < x.end) || null;
  const next = real.find((x) => x.start > now) || null;
  const freeNow = all.find((x) => x.item.free && now >= x.start && now < x.end) || null;

  // ---- Nothing ahead at all ----
  if (!current && !next) {
    const ended = now > model.seasonEnd;
    return `<section class="card card--float now cat-libre">
        <div class="now__top"><span class="now__label">${ended ? "Formation terminée" : "Rien de prévu"}</span></div>
        <h2 class="now__title">${ended ? "Bravo, la formation est finie !" : "Pas de cours à venir"}</h2>
        <p class="meta">Ajoute tes propres événements avec le bouton « + ».</p>
      </section>`;
  }

  // ---- Something is happening now ----
  if (current) {
    const it = current.item;
    const total = current.end - current.start;
    const pct = Math.max(2, Math.min(100, ((now - current.start) / total) * 100));
    const left = (current.end - now) / 60000;
    const following = next ? `<div class="now__next">${icon("right", "icon--s")}<span>Ensuite · <b>${esc(whenShort(next, now))}</b> · ${esc(next.item.kind === "perso" ? next.item.title : next.item.short || next.item.title)}</span></div>` : "";
    return `<section class="card card--float now cat-${esc(it.cat)}" ${attrs(it)} tabindex="0" role="button"
        aria-label="${esc(`En ce moment : ${it.title}, jusqu’à ${hour(itemEnd(it))}. Encore ${duration(left)}.`)}">
        <div class="now__top">
          <span class="now__label"><span class="live-dot" aria-hidden="true"></span>En ce moment</span>
          <span class="badge badge--cat">${esc(kindOf(model, it))}</span>
        </div>
        <h2 class="now__title">${esc(it.title)}</h2>
        ${metaHTML(it)}
        <div class="progress">
          <div class="progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct.toFixed(1)}%"></i></div>
          <div class="progress__legend"><span>${hour(it.start)}</span><b>encore ${duration(left)}</b><span>${hour(itemEnd(it))}</span></div>
        </div>
        ${following}
      </section>`;
  }

  // ---- Nothing now: what comes next ----
  const it = next.item;
  const doneToday = real.some((x) => x.iso === todayIso && x.end <= now);
  const days = daysBetween(now, next.start);
  let status;
  if (freeNow) status = freeNow.item.title;                                    // « Après-midi libre »
  else if (days === 0) status = doneToday ? "Après la pause" : "Aujourd’hui";
  else if (today.holiday) status = `Férié · ${today.holiday}`;
  else if (today.vacation) status = today.vacation;
  else if (now.getDay() === 0 || now.getDay() === 6) status = "Week-end";
  else if (doneToday) status = "Journée terminée";
  else status = "Prochainement";

  const minutesLeft = (next.start - now) / 60000;
  const end = itemEnd(it);
  let when;
  if (minutesLeft < 18 * 60) {
    when = `<b>dans ${duration(minutesLeft)}</b><span>${days === 0 ? "" : days === 1 ? "demain, " : ""}${hour(it.start)}${end ? ` → ${hour(end)}` : ""}</span>`;
  } else {
    const label = days === 1 ? "Demain" : capitalize(`${DAYS[next.start.getDay()]} ${dayNumber(next.start)} ${days < 7 ? "" : MONTHS[next.start.getMonth()]}`.trim());
    when = `<b>${esc(label)}</b><span>${hour(it.start)}${end ? ` → ${hour(end)}` : ""}</span>`;
  }
  return `<section class="card card--float now cat-${esc(it.cat)}" ${attrs(it)} tabindex="0" role="button"
      aria-label="${esc(`${status}. Prochain : ${it.title}.`)}">
      <div class="now__top">
        <span class="now__label">${esc(status)}</span>
        <span class="badge badge--cat">${esc(kindOf(model, it))}</span>
      </div>
      <h2 class="now__title">${esc(it.title)}</h2>
      ${metaHTML(it)}
      <p class="now__when">${when}</p>
    </section>`;
}
