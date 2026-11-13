# Promo MAPST: the technical guide

Everything a developer (or an AI) needs: what each file does, how to add content, how to update the planning, how to publish, the tests. The short version for humans is `README.md`. Claude Code keeps this file up to date.

## The folders, in one minute

```
index.html              The only page of the app: the icons, the tab bar, one empty
                        "panel" per tab (the pages are drawn inside by the code).
manifest.webmanifest    Lets phones install the app (name, icons, colours).
sw.js                   Keeps a copy on the phone, so the app works offline,
                        and fetches new versions by itself.
.nojekyll               Tells GitHub Pages to serve the files exactly as they are.

css/                    How it looks. Loaded in this order:
  01-tokens.css           the design tokens: colours, font, sizes, light AND dark mode
                          (the values of docs/design/mockups.html), and since Phase 4
                          the gradients of the tabs, glass, motion and safe areas
                          (docs/design/prototype.html, block 1)
  02-base.css             basics: background, text, icons, and the « app feel » rules
                          (nothing selectable, no grey flash, .tap)
  03-components.css       reusable pieces: buttons, chips, cards, lists, switches, sheets
  04-layout.css           the frame: the panels and how they change, the pages, the
                          coloured header (.hd) and sheet (.body) of a tab, the small
                          coloured bar (.topbar), the floating tab bar / side rail
  05-planning.css         the Planning tab (the day cards, the half-day cards, Mois, Année)
  06-screens.css          the welcome, Profil, the Relecture report, the install help
  07-reviser.css          the Réviser tab and the lesson screen
  08-accueil.css          Accueil: the sky, the glass, « le mot », « En ce moment », and
                          the rules that make the picture move
  09-cours.css            the Cours tab: the path of chapters, a chapter (its lessons, its
                          documents), the documents
  10-lecons.css           a lesson of Cours: the deck of cards, full screen (Phase 5)

js/                     How it works.
  app.js                  starts everything: loads the content, says which page each
                          address shows, follows the clock
  core/                   small tools used everywhere
    nav.js                  getting around: the four tabs and how they change, pages
                            that slide in, « back », the swipe from the left edge, the
                            address of every page and sheet
    statusbar.js            the colour of Android's status bar (theme-color), which
                            follows the top of the screen shown
    sheet.js                the panels that slide up from the bottom
    data.js                 the content loaded from content/, shared by every screen
    user.js                 the first name and « welcome seen », saved on the phone
    sun.js                  sunrise and sunset in Nice -> which sky to show on Accueil
    dates.js                dates and hours in French (« lundi 9 novembre », « J-12 »)
    dom.js                  helpers to write HTML safely, icons, the progress ring
    storage.js              saves small things on the phone
    toast.js                short messages at the bottom
    offline.js              offline mode and automatic updates (talks to sw.js)
    texts.js                sentences used in several places (the footer, the version)
  screens/
    welcome.js              the welcome, on the first launch (Bienvenue, ton prénom,
                            install help)
    accueil.js              Accueil: the bay full screen and moving, the greeting,
                            « le mot », « En ce moment »
    profil.js               Profil (it replaced Infos), « À propos du planning »,
                            « Ce que l'appli garde »
    relecture.js            the « Rapport de relecture »
    install.js              help to add the app to the home screen (iPhone Safari,
                            another browser, inside another app, Android)
  cours/                  the Cours tab
    cours.js                its pages: the path (and the glass card to the next lesson),
                            a chapter, « Tous les documents »
    content.js              turns parcours.json + documents.json + lecons/index.json into
                            chapters with their bloc, their colour, their lessons and
                            their documents
    lecons.js               the lessons: their list, fetching their text, and what is
                            saved on the phone (lessons read, the card where one was left)
    markdown.js             reads the text of a lesson (a few Markdown blocks) into cards
    lecon.js                the lesson screen: one card at a time, the questions, the last
                            card, the Relecture of a lesson
  planning/               the Planning tab
    planning.js             its first page: Semaine / Mois / Année, arrows, swipes
    view-week.js            the strip of day cards and the chosen day
    view-month.js, view-year.js   the Mois and Année views (Année: one round dot per
                            day with its date number, 22 px at least, so one month per
                            row on most phones)
    dates-cles.js           the « Dates clés » page
    details.js              the sheet that opens when you tap a half-day
    today.js                what Accueil says about today (on now, next, done, day off)
    model.js                turns content/planning.json into easy-to-use days
    parts.js                pieces shared by the views (a half-day row, the legend...)
    event-form.js           the « + » form for personal events
    personal.js             the personal events, saved on the phone
    export.js               « Ajouter à ton agenda » (.ics file)
  reviser/                the Réviser tab
    reviser.js              its home and the path of lessons of each theme
    content.js              turns themes.json + questions.json into themes and lessons,
                            decides who sees which question, and gives each theme its
                            colour and icon
    player.js               the lesson screen: questions, lives, feedback, celebration
    answer.js               checks a typed answer (capitals, accents, one typo...)
    progress.js             XP, série, questions done, lessons left in the middle,
                            « Mes erreurs » (saved on the phone)
    relecture.js            « Mode relecture »: the verdicts and the report text
    verdict.js              the « Juste / À corriger » buttons and the note sheet
    sound.js, confetti.js   small sounds, vibrations and the end-of-lesson confetti

img/                    « La Baie », the illustration of the app, at dawn, by day, at
                        sunset and at night (copies of docs/design/baie-*.svg)
content/                What the app says (written by Claude chat). Never the code.
  planning.json           the class planning (made by scripts/export_planning.py)
  planning.ics            the same planning for calendars (made by the same script)
  planning-fixes.json     corrections to the official planning, for the whole class
  themes.json             the themes of Réviser, and the lesson titles
  questions.json          the questions of Réviser
  planning-themes.json    which planning topics belong to which theme
  parcours.json           Cours: the blocs and the chapters, in the order of the year
  documents.json          Cours: titles and links of the documents on the class's Drive
  lecons/                 Cours: the lessons (Phase 5): index.json (the list), one .md
                          file per lesson, img/ for their pictures
  mots.json               Accueil: the owner's short lines
  savais-tu.json          Accueil: the « Le savais-tu ? » facts

docs/                   How the work is organised (PLAN.md), the content log
                        (CONTENT.md) and the design (design/). Written by Claude chat.

icons/                  App icons. icon.svg is the drawing; the PNGs are made from it.
  launch/                 the iPhone launch images (the welcome screen)
vendor/fonts/           The font (Plus Jakarta Sans, free licence), stored in the app.

scripts/                Tools (run them on a computer):
  export_planning.py      private planning + planning-fixes.json -> content/planning.json
                          and planning.ics
  check_content.py        checks the questions, the themes, the planning corrections, the
                          Phase 4 files (parcours, documents, mots, savais-tu) and the
                          lessons of content/lecons/ (also run by GitHub)
  check_offline_list.py   checks that sw.js lists every file of the app (also run by GitHub)
  make_launch_images.cjs  makes the iPhone launch images from the welcome screen
  fetch_fonts.sh          downloads the font into vendor/fonts/
  make_icons.cjs          makes the PNG icons from icons/icon.svg

tests/                  Automatic tests, run by Claude Code before each pull request
                        (see « Tests » below).
.github/workflows/      checks.yml: GitHub runs the two check scripts on every pull
                        request (see « The automatic checks » below).
```

There is no framework and no build step: GitHub Pages serves these files as they are.

---

## The design in short

The target is `docs/design/prototype.html` for the frame of the app (the tab bar, Accueil,
the coloured headers, glass, motion, the install sheet) and `docs/design/mockups.html` for
the inside of the other screens (both explained in `docs/design/README.md`).

- Bright: light background, white cards, CAPA navy `#103550` for the text. Turquoise
  `#00E6BF` main buttons with navy text, in both modes.
- One colour per tab: Accueil **soleil** (orange), Cours **lavande**, Réviser **turquoise**,
  Planning **azur** (blue). Each has a gradient (`--grad-cours`…) for the header of the
  tab and the small bar of its pages; classes `m-accueil`, `m-cours`, `m-reviser`,
  `m-planning` give it to a panel.
- Planning colours, named after Nice: **Azur** cours, **Lavande** préparation des épreuves,
  **Olivier** Ville de Nice (centre de loisirs, stage APEC), **Bougainvillier** épreuves et
  dossiers, **Galet** férié / vacances / libre, **Citron** your personal events and the
  notes « à vérifier ».
- Each Réviser theme has a colour, in the order of `content/themes.json`: bougainvillier,
  soleil, lavande, turquoise, azur, olivier (a seventh theme starts again). A new theme
  gets its colour and a default icon without any code change.
- Light or dark: the app follows the setting of the phone. All colours live in
  `css/01-tokens.css`.
- Font: Plus Jakarta Sans. Icons are drawn in `index.html` (no icon library).
- iPhone: the status bar is « black-translucent »: the app draws under the clock, which
  is white, so **the top of every screen is coloured**: the sky on Accueil and the welcome
  (with a soft shade), the header `.hd` of Cours, Réviser and Planning (then the small
  `.topbar` once it has scrolled away), `.topbar.topbar--page` on every page opened from a
  tab, the top row of the lesson. Android's status bar (`theme-color`) follows the same
  colours (`js/core/statusbar.js`).
- A launch image (the welcome screen, with the sky up to the very top) shows while the app
  opens on iPhone. Make them again with `node scripts/make_launch_images.cjs` if the
  welcome screen or `img/baie-aube.svg` changes.
- Motion: three durations and two curves (`--t-fast`, `--t-base`, `--t-slow`,
  `--ease-out`, `--ease-spring`). Phones set to « reduce motion » get none.

### Accueil, the living home

- The picture goes **inside** the page (`fetch("img/baie-<ciel>.svg")`, then inserted), so
  its parts can move: the classes `b-cloud`, `b-boat`, `b-swell`, `b-wave`, `b-glit`,
  `b-glow`, `b-fronds`, `b-star` come from `docs/design/baie.py`, and the rules are in
  `css/08-accueil.css`. It only moves while Accueil is the screen shown (class `is-on`).
  The four pictures in `img/` are copies of `docs/design/baie-*.svg`: copy them again when
  Claude chat redraws them.
- Opening the app: class `is-opening` for 2.2 s, once per launch.
- « Le mot »: `content/mots.json` and `content/savais-tu.json`. With lines of the owner:
  one mot, one fact, and so on; without: facts only. It starts at a line that depends on
  the date and changes every 9 s. A fact opens its theme in Réviser.
- « En ce moment »: `js/planning/today.js` decides (on now, next today, done for today,
  no class today); the card opens the details of that half-day. Under it, at most one
  extra line: an épreuve or a dossier within 14 days, else today's personal event.

### Installing

`js/screens/install.js` looks at the phone and the browser (`installContext()`): iPhone in
Safari (three steps; « en haut » on iPad), iPhone in Chrome, Firefox or Edge (step 1
changes), the small browser inside another app (first « Ouvre ce lien dans Safari » with
« Copier le lien »), Android (the browser's own window when it offers one, otherwise one
line). The pill on Accueil, Profil › « Installer l'appli » and the last step of the welcome
show the same help. Once installed, none of it is shown.

---

## Getting around (and the addresses)

Four tabs in a floating glass bar: Accueil, Cours, Réviser, Planning. Changing tab, the
new one comes from the side of its place in the bar, a « lens » slides under its icon, and
the first blocks of its first screen come up one after the other (class `rise`, `--i`).
Nothing scrolls except the inside of a page, so each tab and page keeps its place.

Pages opened from another one slide in from the right, with « ‹ » at the top left; a swipe
from the left edge of the screen goes back too (on an installed iPhone app; elsewhere the
phone's own « back » does it). Sheets close with ×, a swipe down, a tap outside or
« back ». Each tab remembers where you were; tapping the current tab again goes back to
its first page.

Every page and sheet has its own address (useful to test in a browser):

| Address | What it shows |
|---|---|
| `#accueil` | Accueil (the app opens here) |
| `#accueil?ciel=aube` (or `jour`, `couchant`, `nuit`) | Accueil with that sky, to check the four pictures |
| `#accueil/profil` | Profil (old `#infos` addresses open it) |
| `#accueil/profil/relecture` | the Rapport de relecture |
| `#cours`, `#cours/anatomie-mouvement` | Cours (the path of chapters), a chapter (old `#etudier` addresses open Cours) |
| `#cours/fiche-de-seance?lecon=fiche-de-seance-les-bases` | a lesson of Cours, over its chapter (it resumes where it was left) |
| `#cours/documents` | every document, by chapter |
| `#accueil?installer` | the help to install the app |
| `#reviser`, `#reviser/fiche-de-seance` | Réviser, a theme |
| `#reviser?lecon=anatomie-mouvement-1` | a lesson (it continues where it was left) |
| `#planning`, `#planning/dates-cles` | the Planning, Dates clés |
| `#planning?seance=2026-11-09-am` | the details of a half-day (`am` morning, `pm` afternoon) |

To see the welcome again: Profil › « Revoir la bienvenue » (at the bottom).

---

## How to add content

All content lives in `content/` and is written by Claude chat (see `docs/PLAN.md`). The
formats are described in `CLAUDE.md` (« Content formats »). **Adding or changing content
never needs a change to the code or to `sw.js`**: phones fetch the new files by themselves.

- **A new theme**: add `{ "id": "my-theme", "title": "Mon thème" }` to `content/themes.json`
  (the order of the file is the order on screen, and gives the colour). The id: small
  letters and dashes.
- **Lesson titles**: a theme can have `"lessons": [{ "n": 1, "title": "Os et articulations" }]`.
  The title shows on the path and at the top of the lesson; without one, « Leçon 1 ».
- **Questions** go in `content/questions.json`: one `{ ... }` per question (id, theme,
  lesson, type, question, hint, explanation, source, status, and choices/correct, answers
  or pairs). Lessons are numbered 1, 2, 3... in each theme, with no gap.
  **Ids never change**: progress is saved by question id, so a question can be rewritten
  or moved to another lesson without anyone losing their progress. A removed id is
  simply forgotten.
- **Link planning classes to a theme**: in `content/planning-themes.json`, add a line
  `{ "theme": "my-theme", "keywords": ["word", "other words"] }`. When the title of a class
  contains one of the keywords (capitals and accents don't matter), its details offer
  « Réviser ce thème ».
- **A correction to the planning** for the whole class: see « How to update the planning ».
- **A lesson of Cours** (Phase 5): its text in `content/lecons/<id>.md` and one line in
  `content/lecons/index.json`. `docs/AJOUTER-UNE-LECON.md` is the guide any Claude follows;
  see also « The lessons of Cours » below.

Typography is the app's job: write normal spaces in the data (`Quelle loi ?`); the app
adds the no-break spaces before `? ! : ; »` and after `«` when it shows the text.

### Statuses: who sees which question

| `status` | Meaning | Who sees it |
|---|---|---|
| `brouillon` | Written by Claude chat, not checked yet | Everyone (since 7 Nov 2026). In « Mode relecture » it has an « À vérifier » badge and the « Juste / À corriger » buttons |
| `verifie` | Checked by the owner | Everyone |
| `exemple` | Sample content (the question starts with « [EXEMPLE] ») | Everyone, with an « Exemple » badge |

A lesson appears once it has **at least 5** `brouillon` or `verifie` questions (or one
`exemple`). A theme with nothing to show says « Questions en préparation ».

After any change, run `python3 scripts/check_content.py` (or let GitHub run it on the pull
request), then publish (see below). Phones get it by themselves.

---

## The lessons of Cours (Phase 5)

A lesson is a deck of cards, read on the phone in about five minutes.

- **The files.** `content/lecons/index.json` lists the lessons (`id`, `chapitre`, `title`,
  `minutes`, `source`, `status`, `added`), in order inside each chapter. Each lesson's text
  is `content/lecons/<id>.md`; its pictures are in `content/lecons/img/`. A lesson whose
  chapter is not in `parcours.json`, or whose id is not small letters, digits and hyphens,
  is skipped.
- **How the text is read** (`js/cours/markdown.js`, and the same rules in Python in
  `scripts/check_content.py`): each `## ` title starts a card. Inside a card: paragraphs
  (lines next to each other), `**bold**`, `- ` and `1. ` lists, a simple table (`| a | b |`
  then `|---|---|`), the four boxes `> [!retenir]`, `> [!exemple]`, `> [!piege]`,
  `> [!savais-tu]`, a picture alone on its line `![description](img/name.svg)`, and a
  question: `? …`, then 2 to 4 lines `- [x]` (right) / `- [ ]`, then `= explanation`
  (empty lines between them are allowed). Anything else is shown as plain text. The app
  adds the no-break spaces, as for the questions.
- **On screen** (`js/cours/lecon.js`, `css/10-lecons.css`): full screen over the chapter
  (address `#cours/<chapitre>?lecon=<id>`), the top row on the Cours gradient with × and one
  segment per card. A tap on the right two thirds, a swipe left or → : next card; the left
  third, a swipe right or ← : previous one. Cards slide like the pages (420 ms,
  `--ease-page`). A question is answered with one tap (its choices are shuffled, like in
  Réviser); until then, going forward is blocked on that card (cards already passed in an
  earlier visit never block). The last card is the app's: « Leçon terminée », « Teste-toi »
  (opens the chapter's theme in Réviser) and « Retour au chapitre ».
- **Saved on the phone** (`promo-mapst:lecons`): `{ "<id>": { "at": 3, "read": "2026-11-13" } }`,
  the card where the lesson was left (it resumes there) and the day it was read (reaching
  the last card; it then starts again from the first card).
- **In Cours**: every bloc and every chapter of `parcours.json`. A chapter with neither a
  lesson nor a theme is washed out with « Bientôt » (it still opens). Pills: « 2 leçons »
  (filled with a check once all are read), « Quiz 7/10 », « Bientôt ». A glass card at the
  top opens the next lesson not read yet, in the order of the path (« Commencer », or
  « Continuer » once started). The chapter's page: its lessons (number, title, minutes, a
  check when read, « Nouveau » for 7 days after `added`), « Réviser ce chapitre », then
  « Documents » (a locked row « Bientôt » while the chapter has none).
- **Offline**: `sw.js` saves `content/lecons/index.json` and every lesson it lists when it
  installs, and the app fetches every lesson and its pictures in the background a moment
  after each start. Nothing is listed by hand, so a new lesson needs no code.

---

## Relecture: checking the questions on your phone

1. On Accueil, tap the round initial (top right) to open **Profil**, and switch on
   **Mode relecture**. In Réviser, the questions not checked yet now show « À vérifier »
   and their id, and every lesson is open.
2. Play a lesson. After each answer to a question « À vérifier », tap **Juste**, or
   **À corriger** and write a short note if you want (« la réponse C est aussi juste »).
   The letters A, B, C, D appear on the choices once you have answered: they are the order
   of the file, so Claude chat knows which choice you mean.
3. Open **Profil › Rapport de relecture** (or the « Mode relecture » card in Réviser) ›
   **Copier le rapport**, and paste it into your chat with Claude chat.
4. Claude chat fixes the questions « À corriger » and switches the others to `verifie`.
5. Back in the report, **Effacer le rapport** (tap twice) to start the next round.

Your verdicts stay on your phone. If Claude chat rewrites a question, your old verdict on
it disappears by itself, so you check the new version.

**The lessons of Cours** (Phase 5) are checked as a whole: with « Mode relecture » on, a
lesson still `brouillon` has the « À vérifier » badge on its row, and its last card has
« Juste » / « À corriger » (with the same note sheet). The verdict is saved under
`lecon:<id>` with a fingerprint of the lesson's title and text. The report lists them
under a heading « Leçons », after the questions (only when at least one lesson has a
verdict), and the « Rapport de relecture » page has a « Leçons » list.

---

## The automatic checks (the green tick or the red cross)

On every pull request, GitHub runs `scripts/check_content.py` (are the questions, the
themes, the planning corrections, the path of Cours, the documents, the lines and the facts
of Accueil, and the lessons well written?) and `scripts/check_offline_list.py`
(does `sw.js` list every file of the app?). The result is shown on the pull request page,
above the « Merge » button:

- a **green tick ✓** « All checks have passed »: fine, you can merge;
- a **red cross ✗** « Some checks were not successful »: something must be fixed first.
  Click **Details** next to the cross: the last lines say what is wrong, with the id of
  the question (for example `anat-1-04: "correct" has 4, but the choices go from 0 to 3`).
  Don't merge: copy those lines to Claude chat (for content) or to Claude Code (for code),
  and the fix will update the same pull request. The tick turns green by itself.

A red cross never breaks the app: nothing is published until you merge.

---

## How to update the planning

The class planning comes from the private repository `Claude-timetable-artefact`
(it holds the official PDF and personal data, so it stays private). The script copies
only what applies to the whole class, then applies the corrections of
`content/planning-fixes.json`.

1. Update the private repository first (new planning, corrections in `content.json`).
2. On a computer, put both repositories side by side, for example:
   ```
   Documents/promo-mapst
   Documents/Claude-timetable-artefact
   ```
3. In a terminal, in the `promo-mapst` folder, run:
   ```
   python3 scripts/export_planning.py ../Claude-timetable-artefact
   ```
   If the official planning PDF is newer, add its date: `--planning-date 2027-01-15`.
   To see what it would do without writing anything: add `--check`.
4. Read what it prints (what was left out, the trainer initials, the corrections it
   applied). It stops by itself and writes nothing if it finds a name, a phone number or
   an address in its output. If nothing changed, the files stay exactly the same.
5. Publish `content/planning.json` and `content/planning.ics` (see below).

Or simply ask Claude: « Mets à jour le planning de l'appli depuis mon dépôt privé ».

**Corrections for the whole class** (an email from CAPA, a change announced in class) go in
`content/planning-fixes.json` (format in `CLAUDE.md`): for example, from 2 to 20 November
the half-days « MSP 1 » become the « Stage APEC · AnimaNice ». The script applies them on
every run, so a new export never undoes them, and `scripts/check_content.py` warns if one
is not in `planning.json` yet. A place written there (« AnimaNice ») is public, so the
safety net lets it through; names of people never.

What the script keeps: hours, place name and topic of every half-day, trainer
**initials**, épreuves and dossier deadlines, school holidays (zone B) and public holidays,
the stages of the year, the corrections (pageFix, holidays, cellNotes, planning-fixes.json).
What it leaves out: names, contacts, addresses, the personal stage, the activities of one
person's centre, personal events and notes about one person.

---

## How to publish

The app is served by **GitHub Pages** from the `main` branch of this repository.

**Once (first time only):** on github.com, open the repository › **Settings** › **Pages**
(left menu). Under « Build and deployment », Source: **Deploy from a branch**; Branch:
**main** and **/ (root)**; click **Save**. After 1–2 minutes the app is at:
`https://invinciricker.github.io/promo-mapst/`

**Each update:** merge the pull request into `main`. GitHub Pages publishes it in
1–2 minutes. Phones get the new version by themselves:
- new content (planning, questions...) is used the next time the app opens with internet;
- new code: the app downloads it in the background and reloads (or shows
  « Une nouvelle version de l'appli est prête » with a « Recharger » button).

**If you add a new code file** to `css/`, `js/` or `img/`, add it to the list at the top of
`sw.js`, then run `python3 scripts/check_offline_list.py` to check nothing is missing.
Content files (`content/...`) don't need to be listed: `sw.js` saves each one the first
time it is opened.

---

## Try it on a computer

In the folder of the repository:
```
python3 -m http.server 8000
```
Then open `http://localhost:8000` in Chrome or Safari. To see it like on a phone: right
click › Inspect › the phone icon. The designs are at
`http://localhost:8000/docs/design/prototype.html` and `…/docs/design/mockups.html`.

---

## Tests

For Claude Code (or anyone with a computer), before each pull request:
```
python3 scripts/check_content.py
python3 scripts/check_offline_list.py
python3 tests/test_check_content.py
python3 tests/test_planning_fixes.py
python3 tests/test_app.py
python3 tests/test_lecons.py
python3 tests/test_reviser.py
python3 tests/test_offline.py
```
The last four need Python Playwright (`pip install playwright`, then
`python3 -m playwright install chromium`, or set `CHROME_PATH` to a Chromium).
`test_app.py` goes through the welcome, Accueil at different moments of the day and its
four skies (with and without lines of the owner), the four tabs and how they move, the
pages and the « back » gestures, Cours (the 19 chapters and the four filters, an empty
chapter, a chapter with a lesson, the glass card, a chapter with and without documents,
and a made-up list of documents to see the search), the Planning (Année with its date
numbers), Profil, and the install help as an iPhone in Safari, in another browser, inside
Instagram, and as an Android phone. It saves screenshots at 390 × 844 in light and dark mode (their folder is
printed at the end), to compare with the prototype and the mockups. It takes a few
minutes, because it waits for « le mot » to change. `test_lecons.py` reads lessons of Cours like a person would: forward and
back (taps, swipes, arrows), a question right and wrong, × in the middle and back to the
same card, the last card, « Teste-toi », a made-up lesson with every block, a lesson that
can't load, the Relecture of a lesson and its report (screenshots: a text card, a table,
a question answered, the last card, light and dark).
`test_reviser.py` plays lessons like a person would.
`test_offline.py` checks the offline mode (lessons included, even one never opened) and
that new content (a theme, a lesson) is picked up without any code change. `test_planning_fixes.py` checks the planning corrections.

---

## Privacy

- No account (yet), no cookies, no analytics, no ads, nothing loaded from other websites.
- Your first name, personal events (« + »), your progress in Réviser, the lessons read in
  Cours and your Relecture verdicts are saved on the phone only (accounts and sync come in
  Phase 6).
  Profil › « Ce que l'appli garde » lists them, and erases the progress if you want.
- This repository is public: never commit personal data, course PDFs, slides or photos.
  The private planning repository must never be copied here (`.gitignore` blocks the
  usual folder names).

## Credits

- Font: [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans), SIL Open Font
  License (see `vendor/fonts/LICENSE-plus-jakarta-sans.txt`).
- Illustration « La Baie »: drawn for the app by Claude chat (`docs/design/baie.py`).
- Planning: CAPA Sports' MAPST planning (version of 1 Oct 2026) and the course calendar.
- No CAPA Sports logo is used.
