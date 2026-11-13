/* =====================================================================================
   sound.js: small sounds and vibrations for right and wrong answers.

   The sounds are made by the phone itself (Web Audio), so there is no sound file to
   download. On iPhone they follow the silent switch (when the phone allows it). They can
   be switched off in Réviser (button with the speaker); the choice is saved on the phone.
   Vibrations only exist on Android phones, and stop with the sounds.
   ===================================================================================== */

import { load, save } from "../core/storage.js";

let context = null;

export function soundOn() { return load("reviser-sound", true); }
export function setSoundOn(on) { save("reviser-sound", Boolean(on)); }

function audio() {
  if (!soundOn()) return null;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  try {
    // iPhone (iOS 17 and later): "ambient" sounds stay quiet when the phone is on silent.
    if (navigator.audioSession) navigator.audioSession.type = "ambient";
    if (!context) context = new Context();
    if (context.state === "suspended") context.resume();
  } catch (error) {
    return null;
  }
  return context;
}

/** One soft note: frequency in Hz, start and length in seconds. */
function note(ctx, frequency, start, length, type = "sine", volume = 0.07) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  const t = ctx.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

function vibrate(pattern) {
  if (soundOn() && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (error) { /* not important */ }
  }
}

/** Right answer: two bright notes going up. */
export function playRight() {
  const ctx = audio();
  if (ctx) {
    note(ctx, 880, 0, 0.16);        // A5
    note(ctx, 1318.5, 0.09, 0.26);  // E6
  }
  vibrate(10);
}

/** Wrong answer: two low notes going down. */
export function playWrong() {
  const ctx = audio();
  if (ctx) {
    note(ctx, 311, 0, 0.18, "triangle", 0.09);
    note(ctx, 233, 0.12, 0.3, "triangle", 0.09);
  }
  vibrate([20, 40, 20]);
}

/** A pair matched in « Associer »: one short note. */
export function playPair() {
  const ctx = audio();
  if (ctx) note(ctx, 1046.5, 0, 0.14, "sine", 0.05);
  vibrate(8);
}

/** End of a lesson: a little arpeggio. */
export function playWin() {
  const ctx = audio();
  if (ctx) {
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => note(ctx, f, i * 0.09, 0.3, "sine", 0.06));
  }
  vibrate([15, 60, 15, 60, 30]);
}
