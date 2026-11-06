/* =====================================================================================
   toast.js: a short message that appears at the bottom for a few seconds.
     showToast("Événement enregistré")
     showToast("Nouvelle version", { action: "Recharger", onAction: () => location.reload() })
   ===================================================================================== */

import { esc, typo } from "./dom.js";

let current = null;
let timer = null;

export function showToast(message, { action = "", onAction = null, duration = 3200 } = {}) {
  hideToast();
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.innerHTML = typo(`<span>${esc(message)}</span>` +
    (action ? `<button type="button" class="toast__action">${esc(action)}</button>` : ""));
  if (action && onAction) {
    el.querySelector(".toast__action").addEventListener("click", () => { hideToast(); onAction(); });
  }
  document.getElementById("layers").appendChild(el);
  current = el;
  requestAnimationFrame(() => el.classList.add("is-visible"));
  if (duration) timer = setTimeout(hideToast, duration);
}

export function hideToast() {
  clearTimeout(timer);
  if (!current) return;
  const el = current;
  current = null;
  el.classList.remove("is-visible");
  setTimeout(() => el.remove(), 400);
}
