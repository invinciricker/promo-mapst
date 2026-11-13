# Promo MAPST

## What it is
A free web app called « Promo MAPST », for the trainees of my BPJEPS MAPST course (multi-activités physiques ou sportives pour tous) at CAPA Sports in Nice, 14 Sept 2026 → 4 June 2027. My classmates use it almost only as an app installed on their phone (iPhone and Android): they open a link and add it to their home screen. It is hosted on GitHub Pages from this public repository.

Four tabs in a floating bar at the bottom:
1. Accueil: the home. The Baie des Anges full screen and moving, one short line, and what's on now. Nothing else.
2. Cours: the programme as a path of chapters in the order of the year, by bloc de compétences; each chapter leads to its quiz and to its documents on the class's Google Drive (since Phase 4). The fun lessons (« fiches ») join it in Phase 6.
3. Réviser: Duolingo-style quizzes on the course.
4. Planning: the course timetable by week, month and year.

I'm a beginner. Explain things in plain English, keep it short, and tell me exactly what to click.

## Who does what
- **Claude chat** (my claude.ai Project « BPJEPS MAPST », which holds the course files) does the thinking: it plans each phase, takes the design decisions, writes the prototype in docs/design/, the brief of the phase in docs/phases/, everything in content/ and docs/, and gives me the prompt for each Claude Code session. It only pushes to branches named chat/….
- **Claude Code** builds exactly what the brief of the phase says: index.html, css/, js/, sw.js, the manifest, scripts/, tests/, .github/, vendor/, img/, and it keeps README.md's table, docs/TECH.md and « État » below up to date. It never edits content/ or the rest of docs/: if something there looks wrong, it lists it in the pull request. When the brief is silent or contradicts itself, it takes the simplest option that matches the prototype and lists it under « Choix faits » instead of stopping.
- **I** decide, test on my phone, check the questions in Relecture mode and merge.
- Nothing reaches main except through a pull request that I merge.
- How the work flows, and every decision so far: docs/PLAN.md. What content exists and where it comes from: docs/CONTENT.md.

## The phase to build now
**Phase 4, « Une vraie appli »: docs/phases/phase-4.md.** Read it whole, then open docs/design/prototype.html.

## Rules for the whole app
- Everything the user sees is in French, short, with « tu ». No-break space before ? ! : ; » and after « (the app adds them when it shows content; the data keeps plain spaces).
- Plain HTML, CSS and JavaScript, no framework. No build step for the site: GitHub Pages serves the committed files as they are. Scripts may prepare files as long as the result is committed.
- Libraries and fonts live in vendor/. Nothing loads from a CDN at runtime.
- Installable app (PWA) that works offline after the first visit. When I publish an update, phones get the new version and the new content by themselves. content/ files are fetched network-first with the saved copy as fallback, and never need a change in code or in sw.js.
- It must feel like an app, not a website: see « App feel » in docs/phases/phase-4.md. Phone first; comfortable on a laptop too. Light and dark mode.
- No analytics, cookies, ads or trackers.
- All content lives in data files under content/ (formats below), never in the code.
- This repository is public. Never commit personal data, course PDFs, slides or photos. Trainers appear as initials only.
- No CAPA Sports logo, and no Duolingo name, logo or mascot. Footer (in Profil): « Application non officielle créée par un stagiaire. En cas de doute, vérifie dans tes cours. »
- Useful comments in the code, and folders and files that a beginner can follow.
- **Words for humans.** README.md stays short and readable; the technical detail lives in docs/TECH.md. A pull request description starts with « En bref » (3 to 5 plain sentences, no file names), then « À tester sur ton téléphone » (a short checklist), then « Choix faits » if any; everything technical goes inside a `<details>` block under them.
- At the end of each phase: open a pull request, update « État » (25 lines at most), tell me exactly what to test on my phone, and wait for my go before the next phase.

## Design
Bright, colourful and alive: it should feel like a good app from the App Store, because classmates decide in three seconds.
- The source of truth is docs/design/: prototype.html (Phase 4: the frame, the tab bar, Accueil, the tab headers, motion, glass) and mockups.html (Phase 3: the inside of the other screens). docs/design/README.md explains both.
- CAPA navy #103550 is the colour of the text. Turquoise #00E6BF: main buttons and correct answers. One colour per tab: Accueil soleil (#F09000), Cours lavande, Réviser turquoise, Planning azur (#1070B0). The planning categories and the Réviser themes use the Nice palette (lavande, bougainvillier, olivier, galet, citron…).
- Font: Plus Jakarta Sans, in vendor/fonts. Colours, sizes and motion live in css/01-tokens.css.
- « La Baie » (img/baie-*.svg, drawn by docs/design/baie.py) is Claude chat's: if a picture needs changing, ask.
- On 6 Nov 2026 I dropped the "Riviera" design of my personal timetable page (private repository invinciricker/Claude-timetable-artefact, which still holds the planning data): don't copy it.

## Content formats
Claude chat writes the content in these exact formats, so keep them. If you need to change one, ask me first.
- content/themes.json: a list of { "id", "title" } in display order, with optional "lessons": a list of { "n", "title" }.
- content/questions.json: a list of questions with id, theme, lesson (number), type ("qcm", "saisie" or "paires"), question, hint, explanation, study (optional), source and status ("brouillon": not checked by me yet; "verifie": checked; "exemple": sample). Everyone sees "brouillon" and "verifie" questions. A qcm also has choices (list) and correct (list of indexes); a saisie has answers (accepted answers, main one first); a paires has pairs (list of [left, right]). Ids never change.
- content/parcours.json (Phase 4): { "about", "blocs": [{ id, short, title }], "chapitres": [{ id, title, bloc, when, theme (a Réviser theme id, optional), resume }] }, chapters in the order of the year.
- content/mots.json (Phase 4): { "about", "mots": [{ "text", "label" (optional), "by" (optional) }] }: my short lines for Accueil; text is 110 characters at most.
- content/documents.json (Phase 4): { "about", "folder", "documents" }. "folder" is the address of the class's Drive folder, or empty. Each document has id, chapitre (a chapter id, or "general"), title, kind ("pdf", "diapo", "tableur", "doc", "video" or "lien"), url (https), added (date), and an optional note (one short line).
- content/savais-tu.json (Phase 4): a list of { "id", "theme", "text", "question" }: the short facts shown on Accueil. text is 100 characters at most; question is the id of the question it comes from (optional).
- content/planning.json and content/planning.ics: built by scripts/export_planning.py from my private repository; content/planning-themes.json maps the planning's topics to the themes.
- content/planning-fixes.json: { "about", "fixes": [ … ] }: corrections to the official planning, applied by the export script on every run. Each fix has id, added, from and to (dates), match (the fields a half-day must have), set (the fields that replace them), and optional stage, check, category and why.
- content/study/index.json and content/study/<id>.md (Phase 6): the study pages; see docs/phases/phase-6.md.

## Phases
1. App shell, Planning, publishing on GitHub Pages. Done.
2. Réviser. Done.
3. Nouveau look: Accueil, the welcome, the new design. Done.
4. Une vraie appli: four tabs with Cours (the path of chapters), the full-screen living home, glass, motion, installing. **Now: docs/phases/phase-4.md.**
5. Comptes, classement et questions de la promo. Draft: docs/phases/phase-5.md.
6. Les fiches (study pages, inside Cours). Draft: docs/phases/phase-6.md.

The original briefs of phases 1 to 3 are in docs/phases/phases-1-3.md, for the record.

## État
(Updated by Claude at the end of each phase.)

**13 Nov 2026: Phase 4 (« Une vraie appli ») done, in a pull request, waiting for the go before Phase 5.** Phases 1 to 3 are in main. Everything technical is in docs/TECH.md.
- Frame: status bar « black-translucent », so the top of every screen is coloured (sky, header `.hd`, small `.topbar`, `.topbar--page` on pages, the lesson's top row). Android's theme-color follows the screen (js/core/statusbar.js). html and body never scroll; each page is its own scroller and keeps its place. Safe areas come from `--safe-top` / `--safe-bottom`.
- Tokens of the prototype (gradients, glass, three durations, two curves, tab bar sizes) in css/01-tokens.css; « app feel » rules in css/02-base.css (nothing selectable except questions, explanations and fields; class `tap`).
- Four tabs (js/core/nav.js, TABS = accueil, cours, reviser, planning): a floating glass capsule with a lens under the active icon; a side rail on a laptop. Changing tab: classes `is-entering` / `is-leaving` and `--dir` on the panels, `rise` + `--i` on the first blocks, `navigator.vibrate(8)`. Panels have class `m-accueil`, `m-cours`, `m-reviser`, `m-planning`. Old #etudier addresses open Cours. Pages can have `onActive(true/false)`.
- Accueil (js/screens/accueil.js, css/08-accueil.css): one fixed screen. The sky is put inside the page (img/baie-*.svg, copied again from docs/design/) and moves only while Accueil is shown (class `is-on`); cross-fade when the sky changes; `is-opening` once per launch (playOpening, called by app.js). Greeting, date, pill « Installer l'appli » (not installed only), round button to Profil. Dock: « le mot » (content/mots.json and savais-tu.json, alternating, every 9 s, a fact opens its theme) and « En ce moment » (js/planning/today.js; opens the half-day's details; one extra line: dossier/épreuve within 14 days, else today's personal event). No more XP, série, ring or Réviser card there.
- Cours (js/cours/, css/09-cours.css): #cours the path of chapters with bloc filters; #cours/<id> a chapter (« Réviser ce chapitre », documents, « Fiche bientôt »); #cours/documents every document, search from 8. Data: content/parcours.json, content/documents.json (empty for now). Links: « Voir le chapitre » in a half-day's details, « Documents du chapitre » at the bottom of a theme.
- Réviser: coloured header with série and XP chips and the glass card of the lesson to continue; « Mes erreurs » only when some are due; tinted tiles. The lesson's top row is white on the Réviser gradient. Vibration 10 (right) and [20, 40, 20] (wrong), off with the sounds.
- Planning: header with « Aujourd'hui », « + », the Semaine / Mois / Année control and the period with two arrows. Semaine: sliding strip of day cards (label, two bars), title, half-days as cards (« En cours », time left, progress), banners, then Dates clés and Ajouter à ton agenda. Mois: the calendar straddles the header. « Couleurs » only in Mois and Année.
- Installing (js/screens/install.js): one help for the pill, Profil and the welcome's last step: iPhone Safari (iPad « en haut »), another iOS browser, in-app browsers (« Copier le lien »), Android (the browser's own window when offered).
- Welcome: same steps; the sky under the clock with a shade, then an amber bar on the next steps.
- sw.js: cache promo-mapst-v3, new files listed, the four new content files saved at installation. Manifest theme_color #0A5489. iPhone launch images made again.
- scripts/check_content.py also checks parcours.json, documents.json, mots.json and savais-tu.json.
- Tests (run before each pull request, CHROME_PATH for Chromium): tests/test_app.py (234 checks, screenshots 390 × 844 light and dark), tests/test_reviser.py, tests/test_offline.py (10), tests/test_planning_fixes.py (21), tests/test_check_content.py (31). See docs/TECH.md « Tests ».
- To watch on a real iPhone: the clock on every screen, the glass blur and the moving sea (battery, smoothness), the swipe from the left edge, the launch image.
- When adding a code file to the app (css/, js/, img/), add it to the list in sw.js (check with scripts/check_offline_list.py). Content files never need it.
