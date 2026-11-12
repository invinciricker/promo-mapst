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

**8 Nov 2026: Phase 3 (Nouveau look) done, in a pull request, waiting for the go before Phase 4.** Phases 1 and 2 were merged on 6 Nov 2026; chat/phase-3 was already in main.
- Look: tokens of docs/design/mockups.html in css/01-tokens.css (dark mode with prefers-color-scheme; tone-… and cat-… classes give var(--c), --c-ink, --c-tint). Bright pages, white cards, navy text, one colour per tab (Accueil soleil, Réviser turquoise, Planning azur). Theme colours follow themes.json order (js/reviser/content.js THEME_TONES, icons by theme id, default « bolt »).
- Getting around (js/core/nav.js, replaces router.js): 3 tabs, Étudier hidden until Phase 5; pages slide in with « ‹ » and a swipe from the left edge (only when installed on iPhone, or on Android/laptop: Safari's own gesture does it in the browser); sheets and the lesson are "modals". Every page and sheet has an address: #accueil, #accueil/profil(/relecture|/planning|/donnees), #reviser(/<theme>|/relecture), #planning(/dates-cles), and ?seance=, ?evenement=, ?agenda, ?couleurs, ?prenom, ?installer, ?aide, ?note=, ?lecon=<theme>-<n>, ?revision. History: step 0 is always #accueil, then the tab's pages; changing tab rewinds and rewrites; each tab remembers its pages; tapping the current tab goes to its first page; old #infos addresses open Profil.
- Welcome (js/screens/welcome.js): Bienvenue (inline dawn SVG, sun rises), « On t'appelle comment ? » (20 characters), install help only when not installed; once per phone (promo-mapst:bienvenue), also for Phase 2 users; Profil › « Revoir la bienvenue » shows it again. First name in promo-mapst:prenom (js/core/user.js).
- Accueil (js/screens/accueil.js, js/planning/today.js, js/core/sun.js): window onto the bay (img/baie-*.svg) chosen from sunrise/sunset of Nice computed in the app (NOAA formulas, ±2 min), #accueil?ciel=aube|jour|couchant|nuit forces it; « Bonsoir » from 18:00; « Aujourd'hui » (now with progress and « encore … », next, « Fini pour aujourd'hui », week-end/holiday/vacation with the next half-day), today's personal events, épreuve/dossier within 14 days with J-x; « Réviser » card (série, XP, ring, Continuer/Commencer, evening nudge, « Tout est à jour »).
- Profil (js/screens/profil.js, replaces infos.js): name and « Changer mon prénom », Mode relecture + Rapport, Installer l'appli, À propos du planning (source, corrections = dated checks, notes without date), Ce que l'appli garde (+ erase progress), footer, version (APP_VERSION in js/core/texts.js).
- Réviser: home (chips, « Continuer » + « Mes erreurs » card, theme tiles), theme page with a vertical path (done, now with ring, open, locked), lesson full screen with the feedback rising from the bottom. Everyone sees "brouillon" and "verifie" questions; a lesson is shown with at least 5 of them (MIN_QUESTIONS); badges, letters A–D, verdicts and « every lesson open » only in Relecture. New: a lesson left with × is kept (progress.js "runs", by lesson key, filtered by question ids) and « Continuer » resumes it (lives and XP kept); « Mes erreurs » still asks before stopping.
- Planning: Semaine (7-day strip with a dot per half-day, swipe the strip for the week, the list for the day, dated checks as citron banners in their week, or in every week of the stage that starts on their date), Mois, Année (+ stages), details sheet with « Réviser ce thème », Dates clés page (Tout / Épreuves et dossiers, J-x, « À confirmer »), « Couleurs » sheet, « + », « Ajouter à ton agenda ». The « En ce moment » card moved to Accueil.
- iPhone: status bar « default », theme-color = page background (light and dark), manifest colours #F3F7FA, 11 launch images (icons/launch/, scripts/make_launch_images.cjs, not cached by sw.js). sw.js cache promo-mapst-v2, img/ listed.
- Planning data: scripts/export_planning.py applies content/planning-fixes.json on every run (slots matching « match » between from and to get « set »; stage, check, category, corrections date), keeps the export date when nothing else changed, and lets « AnimaNice » through only in the final safety check (private notes are still filtered with it). Checked on 8 Nov against the private repository: it gives content/planning.json byte for byte. content/planning.ics differs only in the first line of 149 descriptions (category name « Ville de Nice ») and the DTSTAMP of 22 events, because it was edited by hand: Claude chat can regenerate it. check_content.py now says lessons are shown with 5 brouillon/verifie questions, and checks planning-fixes.json (format, and « not applied yet » warning).
- Tests (run before each pull request, CHROME_PATH for Chromium): tests/test_app.py (123 checks, screenshots 390 × 844 light and dark), tests/test_reviser.py (96), tests/test_offline.py (9), tests/test_planning_fixes.py (21), tests/test_check_content.py (14). See README « Tests ».
- To watch on a real iPhone: the swipe from the left edge (keep only the button if it feels wrong), the launch image, the status bar colour.
- When adding a code file to the app (css/, js/, img/), add it to the list in sw.js (check with scripts/check_offline_list.py). Content files never need it.
