# Promo MAPST

A free web app for the trainees of the BPJEPS MAPST course at CAPA Sports, Nice
(14 Sept 2026 → 4 June 2027). It works on phones (iPhone and Android) and laptops, can be
added to the home screen like a normal app, and works offline.

**Unofficial app made by a trainee.** It is not made or checked by CAPA Sports.

Three modes, one per tab:

| Tab | What it does | Status |
|---|---|---|
| Réviser | Short quizzes on the course: lessons, XP, série, « Mes erreurs », « Mode relecture » | Done (Phase 2) |
| Étudier | A library of study pages | Phase 3 (shows « Bientôt » for now) |
| Planning | The timetable by day, week, month and year | Done (Phase 1) |

Who does what (details in `docs/PLAN.md`): **Claude chat** writes the content (`content/`)
and the docs (`docs/`); **Claude Code** writes the code; **the owner** decides, tests on
their phone, checks the questions (Relecture) and merges the pull requests.

---

## The folders, in one minute

```
index.html              The only page of the app: header, 4 screens, tab bar.
manifest.webmanifest    Lets phones install the app (name, icons, colours).
sw.js                   Keeps a copy on the phone, so the app works offline,
                        and fetches new versions by itself.
.nojekyll               Tells GitHub Pages to serve the files exactly as they are.

css/                    How it looks. Loaded in this order:
  01-tokens.css           all the colours, the font and the sizes (light AND dark mode)
  02-base.css             basics: background, text, icons
  03-components.css       reusable pieces: buttons, cards, lists, sheets, forms
  04-layout.css           the frame: header, tab bar (side bar on a laptop), « + » button
  05-planning.css         the Planning tab
  06-screens.css          Étudier (« Bientôt ») and Infos
  07-reviser.css          the Réviser tab, the lesson screen and the Relecture report

js/                     How it works.
  app.js                  starts everything: loads the content, shows the right screen
  core/                   small tools used everywhere
    dates.js                dates and hours in French (« vendredi 6 novembre », « J-12 »)
    dom.js                  helpers to write HTML safely, icons, phone detection
    storage.js              saves small things on the phone (personal events...)
    sheet.js                the panels that slide up from the bottom
    router.js               which screen is shown (#planning, #reviser...)
    toast.js                short messages at the bottom
    offline.js              offline mode and automatic updates (talks to sw.js)
    texts.js                sentences used in several places (the footer...)
  planning/               the Planning tab
    planning.js             puts it all together: Jour/Semaine/Mois/Année, arrows, swipe
    model.js                turns content/planning.json into easy-to-use days
    now-card.js             the « En ce moment / À venir » card
    view-day.js, view-week.js, view-month.js, view-year.js   the 4 views
    parts.js                pieces shared by the views (a half-day, the legend...)
    details.js              what opens when you tap a half-day
    event-form.js           the « + » form for personal events
    personal.js             the personal events, saved on the phone
    export.js               « Ajouter à ton agenda » (.ics file)
  reviser/                the Réviser tab
    reviser.js              the home of Réviser and the path of lessons of each theme
    content.js              turns themes.json + questions.json into themes and lessons,
                            and decides who sees which question (see « Statuses » below)
    player.js               the lesson screen: questions, lives, feedback, celebration
    answer.js               checks a typed answer (capitals, accents, one typo...)
    progress.js             XP, série, questions done, « Mes erreurs » (saved on the phone)
    relecture.js            « Mode relecture »: the verdicts and the report text
    verdict.js              the « Juste / À corriger » buttons and the note sheet
    sound.js, confetti.js   small sounds, vibrations and the end-of-lesson confetti
  screens/
    soon.js                 Étudier while it is « Bientôt »
    infos.js                the Infos screen (button ⓘ), with the « Mode relecture » switch
    relecture.js            the « Rapport de relecture » (Infos › Rapport de relecture)
    install.js              help to add the app to the home screen

content/                What the app says (written by Claude chat). Never the code.
  planning.json           the class planning (made by scripts/export_planning.py)
  planning.ics            the same planning for calendars (made by the same script)
  themes.json             the themes of Réviser and Étudier, and the lesson titles
  questions.json          the questions of Réviser
  planning-themes.json    which planning topics belong to which theme

docs/                   How the work is organised (PLAN.md) and the content log
                        (CONTENT.md). Written by Claude chat.

icons/                  App icons. icon.svg is the drawing; the PNGs are made from it.
vendor/fonts/           The font (Plus Jakarta Sans, free licence), stored in the app.

scripts/                Tools (run them on a computer):
  export_planning.py      private planning -> content/planning.json + planning.ics
  check_content.py        checks the questions and themes (also run by GitHub)
  check_offline_list.py   checks that sw.js lists every file of the app (also run by GitHub)
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

- Colours of CAPA Sports: navy `#103550` (header, tab bar), turquoise `#00E6BF` (main
  buttons, correct answers), orange `#F09000` (streak and XP), blue `#1070B0` (Azur, courses).
- Light or dark: the app follows the setting of the phone. All colours live in
  `css/01-tokens.css`; every text colour was checked for readability in both modes.
- Planning colours, named after Nice: **Azur** cours, **Lavande** préparation des épreuves,
  **Olivier** centre de loisirs (Ville de Nice), **Bougainvillier** épreuves et dossiers,
  **Galet** férié / vacances / libre, **Citron** your personal events.
- Font: Plus Jakarta Sans. Icons are drawn in `index.html` (no icon library).

---

## How to add content

All content lives in `content/` and is written by Claude chat (see `docs/PLAN.md`). The
formats are described in `CLAUDE.md` (« Content formats »). **Adding or changing content
never needs a change to the code or to `sw.js`**: phones fetch the new files by themselves.

- **A new theme**: add `{ "id": "my-theme", "title": "Mon thème" }` to `content/themes.json`
  (the order of the file is the order on screen). The id: small letters and dashes.
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
  « Réviser ce thème » and « Étudier ce thème ».
- **Study pages** (Phase 3) will go in `content/study/`.

Typography is the app's job: write normal spaces in the data (`Quelle loi ?`); the app
adds the no-break spaces before `? ! : ; »` and after `«` when it shows the text.

### Statuses: who sees which question

| `status` | Meaning | Who sees it |
|---|---|---|
| `brouillon` | Written by Claude chat, not checked yet | Only in « Mode relecture », with an « À vérifier » badge |
| `verifie` | Checked by the owner | Everyone. A lesson appears once it has **at least 5** of them |
| `exemple` | Sample content (the question starts with « [EXEMPLE] ») | Everyone, with an « Exemple » badge |

A theme with nothing to show says « Questions en préparation ».

After any change, run `python3 scripts/check_content.py` (or let GitHub run it on the pull
request), then publish (see below). Phones get it by themselves.

---

## Relecture: checking the questions on your phone

1. Open the app › **ⓘ** (top right) › scroll to « Relecture des questions » › switch on
   **Mode relecture**. Réviser now shows the questions not checked yet (« À vérifier »),
   and every lesson is open.
2. Play a lesson. After each answer to a question « À vérifier », tap **Juste**, or
   **À corriger** and write a short note if you want (« la réponse C est aussi juste »).
   The letters A, B, C, D appear on the choices once you have answered: they are the order
   of the file, so Claude chat knows which choice you mean.
3. Open **ⓘ › Rapport de relecture** (or the « Mode relecture » card in Réviser) ›
   **Copier le rapport**, and paste it into your chat with Claude chat.
4. Claude chat fixes the questions « À corriger » and switches the others to `verifie`.
   Once its pull request is merged, the class sees them.
5. Back in the report, **Effacer le rapport** (tap twice) to start the next round.

Your verdicts stay on your phone. If Claude chat rewrites a question, your old verdict on
it disappears by itself, so you check the new version.

---

## The automatic checks (the green tick or the red cross)

On every pull request, GitHub runs `scripts/check_content.py` (are the questions and
themes well written?) and `scripts/check_offline_list.py` (does `sw.js` list every file of
the app?). The result is shown on the pull request page, above the « Merge » button:

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
only what applies to the whole class.

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
4. Read what it prints (what was left out, the trainer initials). It stops by itself and
   writes nothing if it finds a name, a phone number or an address in its output.
5. Publish `content/planning.json` and `content/planning.ics` (see below).

Or simply ask Claude: « Mets à jour le planning de l'appli depuis mon dépôt privé ».

What the script keeps: hours, place name and topic of every half-day, trainer
**initials**, épreuves and dossier deadlines, school holidays (zone B) and public holidays,
the stages of the year, the corrections (pageFix, holidays, cellNotes).
What it leaves out: names, contacts, addresses, the personal stage, the activities of one
person's centre, personal events and notes about one person. From 2 to 20 Nov it shows the official
planning (« MSP 1 · Ville de Nice »).

---

## How to publish

The app is served by **GitHub Pages** from the `main` branch of this repository.

**Once (first time only):** on github.com, open the repository › **Settings** › **Pages**
(left menu). Under « Build and deployment », Source: **Deploy from a branch**; Branch:
**main** and **/ (root)**; click **Save**. After 1–2 minutes the app is at:
`https://invinciricker.github.io/promo-mapst/`

**Each update:** merge the pull request into `main` (or commit to `main`). GitHub Pages
publishes it in 1–2 minutes. Phones get the new version by themselves:
- new content (planning...) is used the next time the app opens with internet;
- new code: the app downloads it in the background and reloads (or shows
  « Une nouvelle version de l'appli est prête » with a « Recharger » button).

**If you add a new code file** to `css/` or `js/`, add it to the list at the top of
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
click › Inspect › the phone icon.

---

## Tests

For Claude Code (or anyone with a computer), before each pull request:
```
python3 scripts/check_content.py
python3 scripts/check_offline_list.py
python3 tests/test_check_content.py
python3 tests/test_reviser.py
python3 tests/test_offline.py
```
The last two need Python Playwright (`pip install playwright`, then
`python3 -m playwright install chromium`). `test_reviser.py` plays lessons like a person
would, on a phone-sized screen, in light and dark mode and on a laptop, and saves
screenshots (their folder is printed at the end). `test_offline.py` checks the offline
mode and that new content is picked up without any code change.

---

## Privacy

- No account, no cookies, no analytics, no ads, nothing loaded from other websites.
- Personal events (« + »), your progress in Réviser and your Relecture verdicts are saved
  on the phone only (accounts and sync come in Phase 4). Infos › « Effacer ma progression
  dans Réviser » erases the progress.
- This repository is public: never commit personal data, course PDFs, slides or photos.
  The private planning repository must never be copied here (`.gitignore` blocks the
  usual folder names).

## Credits

- Font: [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans), SIL Open Font
  License (see `vendor/fonts/LICENSE-plus-jakarta-sans.txt`).
- Planning: CAPA Sports' MAPST planning (version of 1 Oct 2026) and the course calendar.
- No CAPA Sports logo is used.
