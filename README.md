# Promo MAPST

A free web app for the trainees of the BPJEPS MAPST course at CAPA Sports, Nice
(14 Sept 2026 → 4 June 2027). It works on phones (iPhone and Android) and laptops, can be
added to the home screen like a normal app, and works offline.

**Unofficial app made by a trainee.** It is not made or checked by CAPA Sports.

Three tabs in the bottom bar (a side rail on a laptop):

| Tab | What it does | Status |
|---|---|---|
| Accueil | Today: a window onto the Baie des Anges that follows the sky of Nice, today's classes, the lesson to continue | Done (Phase 3) |
| Réviser | Short quizzes on the course: lessons, XP, série, « Mes erreurs », « Mode relecture » | Done (Phase 2, new look in Phase 3) |
| Planning | The timetable by week, month and year, the key dates | Done (Phase 1, new look in Phase 3) |
| Étudier | A library of study pages | Phase 5 (hidden until then) |

Who does what (details in `docs/PLAN.md`): **Claude chat** writes the content (`content/`)
and the docs (`docs/`); **Claude Code** writes the code; **the owner** decides, tests on
their phone, checks the questions (Relecture) and merges the pull requests.

---

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
                          (the values of docs/design/mockups.html)
  02-base.css             basics: background, text, icons
  03-components.css       reusable pieces: buttons, chips, cards, lists, switches, sheets
  04-layout.css           the frame: the pages, the « ‹ Back » bar, the tab bar / side rail
  05-planning.css         the Planning tab
  06-screens.css          the welcome, Accueil, Profil and the Relecture report
  07-reviser.css          the Réviser tab and the lesson screen

js/                     How it works.
  app.js                  starts everything: loads the content, says which page each
                          address shows, follows the clock
  core/                   small tools used everywhere
    nav.js                  getting around: tabs, pages that slide in, « back », the swipe
                            from the left edge, the address of every page and sheet
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
    accueil.js              Accueil: the window onto the bay, « Aujourd'hui », « Réviser »
    profil.js               Profil (it replaced Infos), « À propos du planning »,
                            « Ce que l'appli garde »
    relecture.js            the « Rapport de relecture »
    install.js              help to add the app to the home screen
  planning/               the Planning tab
    planning.js             its first page: Semaine / Mois / Année, arrows, swipes
    view-week.js            the 7-day strip and the chosen day
    view-month.js, view-year.js   the Mois and Année views
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

docs/                   How the work is organised (PLAN.md), the content log
                        (CONTENT.md) and the design (design/). Written by Claude chat.

icons/                  App icons. icon.svg is the drawing; the PNGs are made from it.
  launch/                 the iPhone launch images (the welcome screen)
vendor/fonts/           The font (Plus Jakarta Sans, free licence), stored in the app.

scripts/                Tools (run them on a computer):
  export_planning.py      private planning + planning-fixes.json -> content/planning.json
                          and planning.ics
  check_content.py        checks the questions, the themes and the planning corrections
                          (also run by GitHub)
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

The target is `docs/design/mockups.html` (explained in `docs/design/README.md`).

- Bright: light background, white cards, CAPA navy `#103550` for the text. Turquoise
  `#00E6BF` main buttons with navy text, in both modes.
- One colour per tab: Accueil **soleil** (orange), Réviser **turquoise**, Planning **azur**
  (blue), Étudier **lavande** from Phase 5. It colours the active tab and the « ‹ » buttons.
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
- iPhone: the status bar is « default » (a dark clock on the light app); a launch image
  (the welcome screen) shows while the app opens. Make them again with
  `node scripts/make_launch_images.cjs` if the welcome screen or `img/baie-aube.svg`
  changes.

---

## Getting around (and the addresses)

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
- **Study pages** (Phase 5) will go in `content/study/`.

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

---

## The automatic checks (the green tick or the red cross)

On every pull request, GitHub runs `scripts/check_content.py` (are the questions, the
themes and the planning corrections well written?) and `scripts/check_offline_list.py`
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
click › Inspect › the phone icon. The mockups are at
`http://localhost:8000/docs/design/mockups.html`.

---

## Tests

For Claude Code (or anyone with a computer), before each pull request:
```
python3 scripts/check_content.py
python3 scripts/check_offline_list.py
python3 tests/test_check_content.py
python3 tests/test_planning_fixes.py
python3 tests/test_app.py
python3 tests/test_reviser.py
python3 tests/test_offline.py
```
The last three need Python Playwright (`pip install playwright`, then
`python3 -m playwright install chromium`, or set `CHROME_PATH` to a Chromium).
`test_app.py` goes through the welcome, Accueil at different moments of the day and its
four skies, the pages and the « back » gestures, the Planning and Profil, and saves
screenshots at 390 × 844 in light and dark mode (their folder is printed at the end), to
compare with the mockups. `test_reviser.py` plays lessons like a person would.
`test_offline.py` checks the offline mode and that new content is picked up without any
code change. `test_planning_fixes.py` checks the planning corrections.

---

## Privacy

- No account (yet), no cookies, no analytics, no ads, nothing loaded from other websites.
- Your first name, personal events (« + »), your progress in Réviser and your Relecture
  verdicts are saved on the phone only (accounts and sync come in Phase 4).
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
