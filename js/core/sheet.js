/* =====================================================================================
   sheet.js: the panels that slide up from the bottom of the screen ("bottom sheets").

   openSheet({ title, body }) shows one and returns { el, body, close }.
   A sheet closes with the × button, a tap on the dark veil, the Escape key, a swipe
   down on its top part, or the Android "back" button (thanks to the browser history).
   ===================================================================================== */

import { $, esc, icon, setHTML } from "./dom.js";

const stack = [];     // sheets currently open (the last one is on top)
let counter = 0;

/**
 * Opens a sheet.
 *   title       text of the title
 *   body        HTML text (or an element) for the content
 *   className   extra class for the sheet
 *   replaceTop  true: replaces the sheet already open instead of stacking (used when one
 *               sheet leads to another, e.g. details -> edit)
 *   onClose     function called once the sheet is closed
 */
export function openSheet({ title = "", body = "", className = "", replaceTop = false, onClose = null } = {}) {
  const previous = stack[stack.length - 1];
  const reuseHistory = replaceTop && previous && !previous.closed;
  if (reuseHistory) finishClose(previous, { instant: true });

  const id = `sheet-${++counter}`;
  const layer = document.createElement("div");
  layer.className = "sheet-layer";
  setHTML(layer, `
    <div class="sheet-backdrop" data-sheet-close></div>
    <div class="sheet ${esc(className)}" role="dialog" aria-modal="true" aria-labelledby="${id}-title" tabindex="-1">
      <div class="sheet__top">
        <div class="sheet__grabber" aria-hidden="true"></div>
        <div class="sheet__head">
          <h2 class="sheet__title" id="${id}-title">${esc(title)}</h2>
          <button type="button" class="icon-btn" data-sheet-close aria-label="Fermer">${icon("close")}</button>
        </div>
      </div>
      <div class="sheet__body"></div>
    </div>`);
  const sheet = $(".sheet", layer);
  const bodyEl = $(".sheet__body", layer);
  if (typeof body === "string") setHTML(bodyEl, body);
  else if (body) bodyEl.appendChild(body);

  $("#layers").appendChild(layer);
  const entry = {
    id, layer, sheet, onClose,
    returnFocus: reuseHistory ? previous.returnFocus : document.activeElement,
    closed: false, waiting: [],
  };
  stack.push(entry);

  // A history step, so that the "back" button of Android closes the sheet.
  if (reuseHistory) {
    history.replaceState({ sheetId: id }, "");
  } else {
    history.pushState({ sheetId: id }, "");
  }
  entry.inHistory = true;

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

  return { el: sheet, body: bodyEl, close: () => closeSheet(entry) };
}

/** Closes a sheet (the top one if none is given). Returns a promise, done once closed. */
export function closeSheet(entry = stack[stack.length - 1]) {
  return new Promise((resolve) => {
    if (!entry || entry.closed) return resolve();
    entry.waiting.push(resolve);
    const state = history.state;
    if (entry.inHistory && state && state.sheetId === entry.id) {
      history.back();           // "popstate" below finishes the job
    } else {
      finishClose(entry);
    }
  });
}

/** Closes every open sheet (used when the screen changes). */
export function closeAllSheets() {
  while (stack.length) finishClose(stack[stack.length - 1], { instant: true });
}

export function hasOpenSheet() {
  return stack.length > 0;
}

function finishClose(entry, { instant = false } = {}) {
  if (entry.closed) return;
  entry.closed = true;
  stack.splice(stack.indexOf(entry), 1);
  if (instant) {
    entry.layer.remove();
  } else {
    entry.layer.classList.remove("is-open");
    setTimeout(() => entry.layer.remove(), 450);
  }
  if (!stack.length) document.documentElement.classList.remove("has-sheet");
  if (!instant && entry.returnFocus && entry.returnFocus.focus && document.contains(entry.returnFocus)) {
    entry.returnFocus.focus({ preventScroll: true });
  }
  if (entry.onClose) entry.onClose();
  entry.waiting.forEach((resolve) => resolve());
}

// Back button (or history.back() above): close the sheet on top.
window.addEventListener("popstate", () => {
  const top = stack[stack.length - 1];
  if (top) finishClose(top);
});

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
    const dy = Math.max(0, lastY - startY);
    entry.sheet.style.transform = `translateY(${dy}px)`;
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
