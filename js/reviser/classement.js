/* =====================================================================================
   classement.js: the classement of the week (Phase 6), page #reviser/classement.

   Opened by a tap on the XP chip in Réviser's header, and by « Classement de la
   semaine » in Profil. One row per person who chose to appear: rank, round initial,
   pseudo, XP of the week. The first three ranks in soleil, galet and bougainvillier;
   my own row in turquoise with « toi ».
     - not signed in: « Le classement de la promo » and « Créer mon compte »;
     - signed in but hidden: a banner « Tu n'apparais pas dans le classement. »
       with « Apparaître »;
     - nobody this week: « Personne n'a encore joué cette semaine. »
   Read when the page opens and with « Actualiser » (top right); the last result is kept
   on the phone for offline (« Mis à jour hier à 18:02 »). The reading and the caps of
   what is sent are in js/compte/compte.js.
   ===================================================================================== */

import { esc, icon, setHTML } from "../core/dom.js";
import { navbarHTML } from "../core/nav.js";
import { toISO, addDays, dayNumber, MONTHS } from "../core/dates.js";
import { showToast } from "../core/toast.js";
import { compte, chargerClassement, classementEnCache, reglerClassement } from "../compte/compte.js";
import { avatarHTML, openCompteSheet, MESSAGES } from "../screens/compte.js";

const TOP = ["soleil", "galet", "bougainvillier"];        // ranks 1, 2 and 3

/** « Mis à jour à 18:02 », « Mis à jour hier à 18:02 », « Mis à jour le 9 novembre à 18:02 ». */
export function misAJour(ms) {
  if (!ms) return "";
  const date = new Date(ms);
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const day = toISO(date);
  if (day === toISO(new Date())) return `Mis à jour à ${time}`;
  if (day === toISO(addDays(new Date(), -1))) return `Mis à jour hier à ${time}`;
  return `Mis à jour le ${dayNumber(date)} ${MONTHS[date.getMonth()]} à ${time}`;
}

/** The round glass button « Actualiser » of the top bar. */
export const refreshButton = () => `<button type="button" class="topbar__btn tap" data-refresh aria-label="Actualiser">${icon("refresh")}</button>`;

export function mountClassement(el) {
  let result = classementEnCache();        // { lignes, at } or null
  let loading = false;
  let failed = "";                         // the message when the last reading failed
  let fresh = true;                        // the rows rise once, when they first appear

  function rowsHTML(lignes, me) {
    return lignes.map((line, i) => {
      const mine = me && line.cle === me.cle;
      const top = i < 3 ? ` tone-${TOP[i]} is-top` : "";
      return `<div class="row classement__row${mine ? " is-me" : ""}${top}${i < 12 ? " rise" : ""}" style="--i:${i}">
          <span class="classement__rank">${i + 1}</span>
          ${avatarHTML(line.pseudo)}
          <span class="row__main row__title">${esc(line.pseudo)}${mine ? ` <span class="classement__toi">toi</span>` : ""}</span>
          <span class="classement__xp">${line.xp} XP</span>
        </div>`;
    }).join("");
  }

  function draw() {
    const me = compte();
    let content;
    if (!me) {
      content = `<div class="card empty classement__empty">${icon("award")}
          <b>Le classement de la promo</b><p>Crée ton compte pour voir où tu en es.</p>
          <button type="button" class="btn btn--primary" data-compte="creer">Créer mon compte</button></div>`;
    } else {
      const banner = me.classement ? "" : `<div class="glass-banner">
          <span>Tu n’apparais pas dans le classement.</span>
          <button type="button" class="btn btn--small btn--primary" data-apparaitre>Apparaître</button></div>`;
      let list;
      if (result && result.lignes.length) {
        list = `<div class="list classement__list${fresh ? " rises" : ""}">${rowsHTML(result.lignes, me)}</div>`;
        fresh = false;
      } else if (result) {
        list = `<div class="card empty">${icon("flag")}<b>Personne n’a encore joué cette semaine.</b><p>À toi d’ouvrir le bal.</p></div>`;
      } else if (failed) {
        list = `<div class="card empty">${icon("alert")}<p>${esc(failed)}</p></div>`;
      } else {
        list = `<div class="card empty classement__wait"><p>Un instant…</p></div>`;
      }
      content = `${banner}${list}
        ${result && result.at ? `<p class="small faint classement__when">${esc(misAJour(result.at))}${failed ? ` · ${esc(failed)}` : ""}</p>` : ""}`;
    }
    setHTML(el, `
      ${navbarHTML("Réviser", "Classement", me ? refreshButton() : "")}
      <div class="page__body classement">
        <h1 class="page-title">Classement</h1>
        <p class="muted classement__sub">Cette semaine · remis à zéro lundi</p>
        ${content}
      </div>`);
    const button = el.querySelector("[data-refresh]");
    if (button) button.classList.toggle("is-spinning", loading);
  }

  async function reload() {
    if (!compte() || loading) return;
    loading = true;
    draw();
    try {
      result = await chargerClassement();
      failed = "";
      fresh = true;
    } catch (error) {
      failed = MESSAGES[error.code] || MESSAGES.inconnu;
    } finally {
      loading = false;
      if (el.isConnected) draw();
    }
  }

  el.addEventListener("click", async (event) => {
    const t = event.target;
    if (t.closest("[data-refresh]")) reload();
    else if (t.closest("[data-compte]")) openCompteSheet({ mode: "creer" });
    else if (t.closest("[data-apparaitre]")) {
      const button = t.closest("[data-apparaitre]");
      button.disabled = true;
      try {
        await reglerClassement(true);
        showToast("Tu apparais dans le classement.");
        await new Promise((resolve) => setTimeout(resolve, 600));
        reload();
      } catch (error) {
        showToast(MESSAGES[error.code] || MESSAGES.inconnu);
        button.disabled = false;
      }
    }
  });
  // Signed in or out (from the sheet opened here): draw again, and read the list.
  const onCompte = () => { result = classementEnCache(); draw(); if (compte() && !result) reload(); };
  window.addEventListener("compte-change", onCompte);

  draw();
  reload();
  return {
    title: "Classement",
    refresh: draw,
    destroy: () => window.removeEventListener("compte-change", onCompte),
  };
}
