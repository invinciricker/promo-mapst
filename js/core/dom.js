/* =====================================================================================
   dom.js: tiny helpers used by every screen.
   ===================================================================================== */

/** Finds one element: $("#planning") */
export const $ = (selector, root = document) => root.querySelector(selector);

/** Finds all matching elements, as a normal array. */
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/**
 * Makes a text safe to put inside HTML. ALWAYS use it for data (titles, notes...),
 * so that a "<" in a text can never break the page.
 */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/**
 * French typography: puts non-breaking spaces inside « » and before : ; ! ? so that they
 * never end up alone at the start of a line.
 */
export function typo(html) {
  return String(html).replace(/« /g, "«\u00A0").replace(/ ([»:;!?])/g, "\u00A0$1");
}

/** Puts HTML inside an element, with the French typography above. Use it instead of innerHTML. */
export function setHTML(element, html) {
  element.innerHTML = typo(html);
}

/** HTML of an icon from the list at the top of index.html: icon("pin") */
export function icon(name, extraClass = "") {
  return `<svg class="icon ${extraClass}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

/**
 * HTML of a round progress ring (the lessons of Réviser): share from 0 to 1.
 * Its colour is var(--c) of the element around it (a "tone-…" class).
 *   size     width in pixels (46 by default, like the mockups)
 *   text     written in the middle (« 4/10 »), optional
 *   track    colour of the empty part
 */
export function ring(share, { size = 46, stroke = 5, text = "", track = "var(--surface-2)", label = "" } = {}) {
  const box = size;
  const r = (box - stroke) / 2 - 1.5;
  const length = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, share)) * length;
  const c = box / 2;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${box} ${box}" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>
      <circle class="ring__track" cx="${c}" cy="${c}" r="${r.toFixed(2)}" fill="none" stroke-width="${stroke}" style="stroke:${track}"/>
      ${filled > 0.5 ? `<circle class="ring__fill" cx="${c}" cy="${c}" r="${r.toFixed(2)}" fill="none" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${filled.toFixed(1)} ${length.toFixed(1)}" transform="rotate(-90 ${c} ${c})"/>` : ""}
      ${text ? `<text class="ring__text" x="${c}" y="${c + 4.5}" text-anchor="middle">${esc(text)}</text>` : ""}
    </svg>`;
}

/** Lower case, no accents, straight apostrophes: to compare or search texts. */
export function plain(text) {
  return String(text ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Is the phone an iPhone or iPad? (some steps differ, like adding to the home screen) */
export function isIOS() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function isAndroid() {
  return /Android/i.test(navigator.userAgent || "");
}

/** Is the app open from the home screen (installed), rather than in the browser? */
export function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

/** Copies a text; returns true if it worked. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Older browsers: copy through a hidden text field.
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    field.remove();
    return ok;
  }
}
