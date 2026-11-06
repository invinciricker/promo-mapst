/* =====================================================================================
   answer.js: checks a typed answer (« Réponse à taper »).

   The rules (see CLAUDE.md):
     - capitals and accents don't matter: « Phosphocreatine » = « phosphocréatine »;
     - every alternative listed in "answers" is accepted;
     - one typo is forgiven, but only in answers of 8 letters or more
       (« phosphocreatin » is accepted, « ATb » for « ATP » is not).
   Also forgiven: spaces, dashes, dots and apostrophes (« L.212-1 » = « L 212 1 »),
   a « le / la / l’ / un / une » at the start, « oe » written for « œ », and small
   digits written as normal ones (« VO₂max » = « VO2max »).
   scripts/check_content.py uses the same rules (its squash()): change both together.
   ===================================================================================== */

import { plain } from "../core/dom.js";

const LEADING_ARTICLE = /^(?:l'|d'|le |la |les |un |une |des |du |de la |de l')/;

/** Reduces a text to its letters and digits: « La loi de Wolff ! » -> "loidewolff" */
export function squash(text) {
  // NFKD turns « ₂ » into « 2 » (and splits accents off, which plain() then removes).
  return plain(String(text ?? "").normalize("NFKD"))   // lower case, no accents, straight apostrophes
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(LEADING_ARTICLE, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Is `a` at most one typo away from `b`? A typo is one letter added, missing, changed,
 * or two neighbouring letters swapped (« phosphocréatnie »).
 */
export function oneTypoAway(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  // Classic "edit distance" table, with swaps counted as one typo.
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d = Array.from({ length: rows }, (_, i) => {
    const row = new Array(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length] <= 1;
}

/**
 * Checks what was typed against the accepted answers.
 * Returns { ok: true, exact: true }        perfect,
 *         { ok: true, exact: false }       accepted with one typo (show the right spelling),
 *         { ok: false }                    wrong,
 *         { ok: false, empty: true }       nothing typed.
 */
export function checkTyped(typed, answers) {
  const given = squash(typed);
  if (!given) return { ok: false, empty: true };
  const expected = answers.map(squash).filter(Boolean);
  if (expected.includes(given)) return { ok: true, exact: true };
  if (expected.some((answer) => answer.length >= 8 && oneTypoAway(given, answer))) {
    return { ok: true, exact: false };
  }
  return { ok: false };
}
