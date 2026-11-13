/* =====================================================================================
   sheet.js: the panels that slide up from the bottom of the screen ("bottom sheets").

   openSheet({ title, body, address }) shows one and returns { el, body, close }.
   A sheet closes with its × button, a tap on the veil, the Escape key, a swipe down on
   its top part, or the back button of the phone.
   Each sheet has its own address (see js/core/nav.js): address ["seance", "2026-11-09-am"]
   writes #planning?seance=2026-11-09-am while it is open.
   ===================================================================================== */

import { $, esc, icon, setHTML } from "./dom.js";
import { openModal, closeModal, replaceModal, forgetModal } from "./nav.js";

const stack = [];     // sheets open now (the last one is on top)
let counter = 0;

/**
 * Opens a sheet.
 *   title      text of the title (in the head, next to ×)
 *   head       HTML for the head instead of the title (a coloured chip, for example)
 *   body       HTML text (or an element) for the content
 *   className  extra class for the sheet (a colour: "cat-cours"...)
 *   address    [key, value] or key: the address of the sheet (?key=value). null: no
 *              address and no step in the history (a sheet over the welcome, which
 *              handles « back » itself)
 *   replace    a sheet already open that this one replaces (details -> edit form):
 *              no new step in the history
 *   onClose    function called once the sheet is closed
 */
export function openSheet({ title = "", head = "", body = "", className = "", address = "feuille",
  replace = null, onClose = null } = {}) {
  const [key, value = ""] = Array.isArray(address) ? address : [address, ""];
  const withAddress = address !== null;
  const id = `sheet-${++counter}`;
  const layer = document.createElement("div");
  layer.className = "sheet-layer";
  setHTML(layer, `
    <div class="sheet-backdrop" data-sheet-close></div>
    <div class="sheet ${esc(className)}" role="dialog" aria-modal="true" ${title ? `aria-labelledby="${id}-title"` : ""} tabindex="-1">
      <div class="sheet__top">
        <div class="sheet__grabber" aria-hidden="true"></div>
        <div class="sheet__head">
          <div class="sheet__head-start">${head || `<h2 class="sheet__title" id="${id}-title">${esc(title)}</h2>`}</div>
          <button type="button" class="icon-btn icon-btn--soft" data-sheet-close aria-label="Fermer">${icon("x")}</button>
        </div>
      </div>
      <div class="sheet__body"></div>
    </div>`);
  const sheet = $(".sheet", layer);
  const bodyEl = $(".sheet__body", layer);
  if (typeof body === "string") setHTML(bodyEl, body);
  else if (body) bodyEl.appendChild(body);

  const entry = { id, layer, sheet, onClose, closed: false, waiting: [], modal: null,
    returnFocus: replace && replace.entry ? replace.entry.returnFocus : document.activeElement };

  if (replace && replace.entry && !replace.entry.closed && replace.entry.modal) {
    // Takes the place of the sheet open now: same step in the history, new address.
    entry.modal = replace.entry.modal;
    entry.modal.close = () => finishClose(entry);
    replaceModal(entry.modal, { key, value });
    replace.entry.modal = null;
    finishClose(replace.entry, { instant: true });
  } else if (withAddress) {
    entry.modal = openModal({ key, value, close: () => finishClose(entry) });
  }

  $("#layers").appendChild(layer);
  stack.push(entry);
  layer.addEventListener("click", (event) => {
    if (event.target.closest("[data-sheet-close]")) closeSheet(entry);
  });
  enableDragToClose(entry);
  document.documentElement.classList.add("has-sheet");

  // Next frame: start the slide-up animation and move the focus into the sheet.
  requestAnimationFrame(() => {
    layer.classList.add("is-open");
    sheet.focus({ preventScroll: true });
  });

  const handle = { el: sheet, body: bodyEl, entry, close: () => closeSheet(entry) };
  return handle;
}

/** Closes a sheet (the top one if none is given). Returns a promise, done once closed. */
export function closeSheet(entry = stack[stack.length - 1]) {
  return new Promise((resolve) => {
    if (!entry || entry.closed) return resolve();
    entry.waiting.push(resolve);
    if (entry.modal) closeModal(entry.modal);     // through the history (like « back »)
    else finishClose(entry);
  });
}

export function hasOpenSheet() {
  return stack.length > 0;
}

function finishClose(entry, { instant = false } = {}) {
  if (entry.closed) return;
  entry.closed = true;
  if (entry.modal) forgetModal(entry.modal);
  stack.splice(stack.indexOf(entry), 1);
  if (instant) {
    entry.layer.remove();
  } else {
    entry.layer.classList.remove("is-open");
    setTimeout(() => entry.layer.remove(), 460);
  }
  if (!stack.length) document.documentElement.classList.remove("has-sheet");
  if (!instant && entry.returnFocus && entry.returnFocus.focus && document.contains(entry.returnFocus)) {
    entry.returnFocus.focus({ preventScroll: true });
  }
  if (entry.onClose) entry.onClose();
  entry.waiting.forEach((resolve) => resolve());
}

// Escape key closes the sheet on top; Tab stays inside the sheet.
document.addEventListener("keydown", (event) => {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeSheet(top);
  } else if (event.key === "Tab") {
    const focusable = Array.from(top.sheet.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

/** Swipe the top of the sheet down to close it. */
function enableDragToClose(entry) {
  const handle = $(".sheet__top", entry.sheet);
  let startY = 0;
  let lastY = 0;
  let startTime = 0;
  let dragging = false;

  handle.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    dragging = true;
    startY = lastY = event.clientY;
    startTime = Date.now();
    entry.layer.classList.add("is-dragging");
    try { handle.setPointerCapture(event.pointerId); } catch (error) { /* not important */ }
  });
  handle.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    lastY = event.clientY;
    entry.sheet.style.transform = `translateY(${Math.max(0, lastY - startY)}px)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    entry.layer.classList.remove("is-dragging");
    const dy = lastY - startY;
    const speed = dy / Math.max(1, Date.now() - startTime);   // pixels per millisecond
    if (dy > 110 || (dy > 30 && speed > 0.6)) {
      entry.sheet.style.transform = "translateY(100%)";        // slide away from where it is
      closeSheet(entry);
    } else {
      entry.sheet.style.transform = "";                         // not far enough: back up
    }
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}
