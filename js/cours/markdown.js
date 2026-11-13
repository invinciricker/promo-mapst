/* =====================================================================================
   markdown.js: reads the text of a lesson (content/lecons/<id>.md) and turns it into a
   deck of cards. Only the few blocks of docs/AJOUTER-UNE-LECON.md are understood:

     ## Title                    starts a new card (its title)
     a paragraph                 lines next to each other; **bold** inside
     - item / 1. item            lists
     | a | b |  + |---|---|      a simple table (the first row is the header)
     > [!retenir] text           a box: retenir, exemple, piege or savais-tu (CALLOUTS)
     ? question                  a small question inside the card:
     - [x] right / - [ ] wrong     2 to 4 choices, exactly one right
     = explanation                 shown once the question is answered
     ![description](img/x.svg)   a picture of content/lecons/img/, alone on its line

   Anything else is shown as plain text, so a mistake in a file never breaks the app
   (scripts/check_content.py reports it). The same rules are written in Python in
   scripts/check_content.py: change both together.
   ===================================================================================== */

import { esc } from "../core/dom.js";

/** The four boxes: their word in the file, their title on screen and their colour. */
export const CALLOUTS = {
  retenir: { label: "À retenir", tone: "turquoise", icon: "check" },
  exemple: { label: "Exemple", tone: "azur", icon: "pin" },
  piege: { label: "Attention", tone: "bougainvillier", icon: "alert" },
  "savais-tu": { label: "Le savais-tu ?", tone: "soleil", icon: "bulb" },
};

const TITLE = /^##\s+(.+?)\s*$/;                       // « ## Title » (not « ### »)
const PICTURE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;        // ![description](img/name.svg)
const SAFE_PICTURE = /^img\/(?!.*\.\.)[A-Za-z0-9._/-]+$/;   // only pictures of content/lecons/img/
const BULLET = /^-\s+(.*)$/;
const NUMBERED = /^(\d+)[.)]\s+(.*)$/;
const CHOICE = /^-\s+\[([ xX])\]\s+(.*)$/;
const QUESTION = /^\?\s+(.*)$/;
const EXPLANATION = /^=\s+(.*)$/;

const isBlank = (line) => line === undefined || line.trim() === "";

/** Does this line start a new block (so it ends the paragraph before it)? */
function startsBlock(line) {
  const t = line.trim();
  return t.startsWith(">") || t.startsWith("|") || BULLET.test(t) || NUMBERED.test(t) || QUESTION.test(t) || PICTURE.test(t);
}

/**
 * The cards of a lesson: [{ title, blocks }], in the order of the file.
 * Blocks: { type: "p", text } · { type: "ul", items } · { type: "ol", items, start }
 *         { type: "table", head, rows } · { type: "callout", name, text }
 *         { type: "question", text, choices: [{ text, right }], explanation }
 *         { type: "img", src, alt }       (src: the path inside content/lecons/)
 */
export function parseLesson(source) {
  const cards = [];
  let card = null;
  for (const line of String(source || "").replace(/\r\n?/g, "\n").split("\n")) {
    const title = TITLE.exec(line);
    if (title) {
      card = { title: title[1], lines: [] };
      cards.push(card);
    } else if (card || !isBlank(line)) {
      // Text before the first « ## » becomes a card without a title.
      if (!card) { card = { title: "", lines: [] }; cards.push(card); }
      card.lines.push(line);
    }
  }
  return cards.map((c) => ({ title: c.title, blocks: parseBlocks(c.lines) }));
}

function parseBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i++; continue; }
    let m;

    // A picture, alone on its line.
    if ((m = PICTURE.exec(t))) {
      blocks.push(SAFE_PICTURE.test(m[2]) ? { type: "img", alt: m[1].trim(), src: m[2] } : { type: "p", text: t });
      i++;
      continue;
    }

    // A box (« > [!retenir] … »), on one or several lines starting with « > ».
    if (t.startsWith(">")) {
      const parts = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) parts.push(lines[i++].trim().replace(/^>\s?/, ""));
      const text = parts.join(" ").trim();
      const box = /^\[!([^\]]+)\]\s*(.*)$/.exec(text);
      const name = box ? box[1].trim().toLowerCase() : "";
      blocks.push(CALLOUTS[name] ? { type: "callout", name, text: box[2].trim() } : { type: "p", text });
      continue;
    }

    // A question: « ? … », then the choices « - [x] » / « - [ ] », then « = explanation ».
    if ((m = QUESTION.exec(t))) {
      const start = i;
      const q = { type: "question", text: m[1].trim(), choices: [], explanation: "" };
      i++;
      const skipBlank = () => { let k = i; while (k < lines.length && isBlank(lines[k])) k++; return k; };
      let k = skipBlank();
      while (k < lines.length && (m = CHOICE.exec(lines[k].trim()))) {
        q.choices.push({ text: m[2].trim(), right: m[1] !== " " });
        i = k + 1;
        k = skipBlank();
      }
      if (q.choices.length && k < lines.length && (m = EXPLANATION.exec(lines[k].trim()))) {
        const parts = [m[1].trim()];
        i = k + 1;
        while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines[i])) parts.push(lines[i++].trim());
        q.explanation = parts.join(" ");
      }
      if (q.choices.length >= 2 && q.choices.some((c) => c.right)) blocks.push(q);
      else blocks.push({ type: "p", text: lines.slice(start, i).map((l) => l.trim()).filter(Boolean).join(" ") });
      continue;
    }

    // A table: rows starting with « | », the second one is « |---|---| ».
    if (t.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(lines[i++].trim());
      const cells = (row) => row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const isRule = (row) => cells(row).every((c) => /^:?-+:?$/.test(c));
      if (rows.length >= 2 && isRule(rows[1])) blocks.push({ type: "table", head: cells(rows[0]), rows: rows.slice(2).map(cells) });
      else blocks.push({ type: "p", text: rows.join(" ") });
      continue;
    }

    // Lists: « - item » or « 1. item ». A line that starts nothing continues the item.
    const listOf = BULLET.test(t) ? "ul" : NUMBERED.test(t) ? "ol" : "";
    if (listOf) {
      const pattern = listOf === "ul" ? BULLET : NUMBERED;
      const list = { type: listOf, items: [] };
      if (listOf === "ol") list.start = Number(NUMBERED.exec(t)[1]);
      while (i < lines.length && !isBlank(lines[i])) {
        const line = lines[i].trim();
        if ((m = pattern.exec(line))) list.items.push(listOf === "ul" ? m[1].trim() : m[2].trim());
        else if (startsBlock(line)) break;
        else list.items[list.items.length - 1] += ` ${line}`;
        i++;
      }
      blocks.push(list);
      continue;
    }

    // A paragraph: the lines next to each other, up to an empty line or another block.
    const parts = [t];
    i++;
    while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines[i])) parts.push(lines[i++].trim());
    blocks.push({ type: "p", text: parts.join(" ") });
  }
  return blocks;
}

/** A line of text as safe HTML, with **bold**. */
export function inlineHTML(text) {
  return esc(text).replace(/\*\*(?=\S)(.+?)\*\*/g, "<b>$1</b>");
}
