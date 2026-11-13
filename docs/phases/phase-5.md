# Phase 5: « Les leçons »

Written by Claude chat on 13 Nov 2026. The whole brief: every decision is taken here. Build exactly this; if something is missing, take the simplest option that fits the look of the app and list it under « Choix faits ».

## Why

The design is settled for now. The owner wants the content: fun, short lessons inside Cours, written from the course so that classmates don't need the documents. And he must be able to add lessons all year **without any code session**: a lesson is two small changes in `content/`, nothing else. The course documents themselves stay closed until the school agrees.

## 1. A lesson is a deck of cards

- Data: `content/lecons/index.json` (the list, in order) and `content/lecons/<id>.md` (the text). Formats in `CLAUDE.md` and, in full, in `docs/AJOUTER-UNE-LECON.md`. Two lessons exist today.
- A lesson opens **full screen**, like a quiz lesson (no tab bar; `#cours/<chapitre>?lecon=<id>`), top row on the Cours gradient: ×, then one thin segment per card (filled up to the current one), white on the gradient.
- One card at a time, each `## ` title of the file starting a card. Tap the right two thirds of the screen or swipe left: next card. Tap the left third or swipe right: previous. Cards slide with the page transition already in the tokens. A card taller than the screen scrolls inside.
- What a card can contain, and how it looks:
  | In the file | On screen |
  |---|---|
  | `## Title` | the card's title, 24 px / 800 |
  | paragraphs, `**bold**`, `- ` and `1. ` lists | body text 17 px, lists with coloured markers |
  | a simple table | a rounded table, first column bold, scrolls sideways if needed |
  | `> [!retenir] …` | a box « À retenir », turquoise tint |
  | `> [!exemple] …` | a box « Exemple », azur tint |
  | `> [!piege] …` | a box « Attention », bougainvillier tint |
  | `> [!savais-tu] …` | a box « Le savais-tu ? », soleil tint |
  | `? question`, then `- [x]` / `- [ ]` lines, then `= explanation` | a small question in the card: the choices as buttons; on tap, right in turquoise and wrong in bougainvillier (same styles as Réviser), the explanation appears. No XP, no lives. The forward tap is blocked on that card until it is answered. |
  | `![alt](img/name.svg)` | a picture from `content/lecons/img/`, full width, rounded |
  Anything else in the file is shown as plain text. The app adds the no-break spaces, as for questions.
- **Last card, added by the app**: « Leçon terminée » with a check that pops, then « Teste-toi » (main button, when the chapter has a `theme`: it opens that theme in Réviser) and « Retour au chapitre ». Reaching it marks the lesson as read.
- Read lessons and the card where one was left are saved on the phone (`promo-mapst:lecons`): reopening a lesson resumes there.
- Text in a lesson can be selected (like explanations).
- In Relecture mode, lessons with status "brouillon" show the « À vérifier » badge on their row, and the last card has « Juste » / « À corriger » (with the optional note) feeding the same report, under a heading « Leçons ». Everyone sees "brouillon" and "verifie" lessons.

## 2. Cours shows the whole programme

- **Filters**: « Tout » and **every** bloc of `parcours.json`, always, even without content.
- **Every chapter** of `parcours.json` is on the path (19 today). Three looks:
  - with at least one lesson or a `theme`: as today;
  - with nothing yet: same card, washed out (opacity .6 on the number and the text), with a single grey pill « Bientôt ». It still opens.
- Pills on a chapter, in this order: « 2 leçons » (or « 1 leçon », filled when all are read, with a check), « Quiz 7/10 » as today, and « Bientôt » when it has neither. The pill « Fiche bientôt » and the pill for documents disappear from the path.
- **A chapter's page**, from top to bottom:
  1. title, « when · bloc title », the `resume`;
  2. « Leçons »: one row per lesson (number, title, « 5 min », a check when read, « Nouveau » for 7 days after `added`). A chapter without lessons: one grey row « Les leçons de ce chapitre arrivent. »;
  3. the button « Réviser ce chapitre », when it has a theme;
  4. « Documents »: while the chapter has no document, a disabled grey row with a lock, « Documents du cours » and the tag « Bientôt ». With documents: as built in Phase 4.
- `#cours/documents` and its row at the end of the path: unchanged (hidden while there are none).
- The top of Cours gets one glass card (same `.gcard` as Réviser) when a lesson is unread: the next unread lesson in path order, « Continuer » if it was started, else « Commencer ». It opens the lesson.
- Accueil: a fact of « le mot » keeps opening its theme in Réviser. Nothing else changes there.

## 3. The year view of Planning

A bug the owner saw: in Année, the days are coloured dots with no number. Each day must show its date number inside the dot (10 px, weight 700, tabular figures; text colour `--on-accent` on filled colours, `--ink-2` on pale or empty ones, so that it reads in light and dark). Make the dots as large as the month's width allows, at least 22 px. Today keeps its ring.

## 4. Adding content must never need code

- `sw.js`: `content/lecons/` (index, .md and img) is content: fetched network-first and saved for offline like the rest of `content/`, without being listed.
- `scripts/check_content.py`: check `content/lecons/index.json` (ids unique, `chapitre` exists in `parcours.json`, `title`, `minutes` a number, `status`, `added`; the file `<id>.md` exists), and each `.md`: at least 3 cards, 12 at most; each `? ` question has two to four choices, exactly one `[x]`, and an `= ` line; callout names are among the four; pictures exist; a warning for a card over 90 words. Also warn about `.md` files that are not in the index.
- `docs/AJOUTER-UNE-LECON.md` is the guide another Claude follows to add a lesson. If you change how a block is written, say so in the pull request: don't edit the guide.

## 5. Tests

Update the tests: the path with 19 chapters and the four filters, an empty chapter, a chapter with a lesson, a full lesson run (forward, back, a question right and wrong, the last card, resume after ×), Relecture on a lesson, the year view with numbers. Screenshots 390 × 844, light and dark: a text card, a card with a table, a question card answered, the last card, the path, a chapter page, Année. Run everything before the pull request.

## Don't change

The look and motion of Phase 4, the formats of the other content files, how Réviser and Planning work.

## At the end

One pull request with « En bref », « À tester sur ton téléphone », « Choix faits ». Update « État » (25 lines at most) and `docs/TECH.md`.
