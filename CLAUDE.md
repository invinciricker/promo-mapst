# Promo MAPST

## What it is
A free web app called « Promo MAPST », for the trainees of my BPJEPS MAPST course (multi-activités physiques ou sportives pour tous) at CAPA Sports in Nice, 14 Sept 2026 → 4 June 2027. My classmates use it almost only as an app installed on their phone (iPhone and Android): they open a link and add it to their home screen. It is hosted on GitHub Pages from this public repository.

Four tabs in a floating bar at the bottom:
1. Accueil: the home. The Baie des Anges full screen and moving, one short line, and what's on now. Nothing else.
2. Cours: the whole programme as a path of chapters in the order of the year, by bloc de compétences. Each chapter has short lessons (decks of cards, Phase 5) and leads to its quiz. The course documents stay closed (« Bientôt ») until my school agrees.
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
**Phase 5, « Les leçons »: docs/phases/phase-5.md.** Read it whole. The look is the app as it is (Phase 4): nothing to redesign.

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
- content/lecons/index.json (Phase 5): { "about", "lecons": [{ id, chapitre, title, minutes, source, status ("brouillon" or "verifie"), added }] }, in order inside each chapter. Each lesson's text is content/lecons/<id>.md: a deck of cards in Markdown (each « ## » starts a card), with the few blocks listed in docs/AJOUTER-UNE-LECON.md. Pictures in content/lecons/img/.
- **Adding lessons, questions, chapters, facts or mots never needs a code session**: docs/AJOUTER-UNE-LECON.md is the guide any Claude follows.

## Phases
1. App shell, Planning, publishing on GitHub Pages. Done.
2. Réviser. Done.
3. Nouveau look: Accueil, the welcome, the new design. Done.
4. Une vraie appli: four tabs with Cours (the path of chapters), the full-screen living home, glass, motion, installing. Done.
5. Les leçons: lessons as decks of cards inside Cours, the whole programme shown, content added without code. **Now: docs/phases/phase-5.md.**
6. Comptes, classement et questions de la promo. Next, after Phase 5: docs/phases/phase-6.md (ready). The database rules and the owner's Firebase steps are in docs/firebase/ (Claude chat's).

The original briefs of phases 1 to 3 are in docs/phases/phases-1-3.md, for the record.

## État
(Updated by Claude at the end of each phase.)

**13 Nov 2026: Phase 6 (« Comptes, classement et questions de la promo ») done, in a pull request, waiting for the owner's test and merge.** Phases 1 to 5 are in main. Everything technical is in docs/TECH.md (« Comptes »).
- js/compte/: config.js (the owner's firebaseConfig; empty = every account feature hidden), backend.js (the only file that talks to Firebase), backend-faux.js (same functions in the browser, `?backend=faux` on localhost), compte.js (who is signed in, the sync, the classement line, caches), regles.js (pure: codes refused, merge, ISO week, caps).
- Firebase 13.1.0 in vendor/firebase/ (app, auth, firestore-lite) via scripts/fetch_firebase.sh, which rewrites the gstatic import to ./firebase-app.js. Loaded with import() only when signed in (1.2 s after start) or at the first account tap. initializeAuth without popup helper: nothing from another website.
- Sync: promo-mapst:reviser + promo-mapst:lecons as progres { v: 1, reviser, lecons }; read, merge, write if changed; 5 s after progres-fini (finishSession, markRead), on hidden with something unsent, on online; ≤ 1 write / 15 s. storage.js watchSaves() dates local changes (promo-mapst:modifie); progress.js reloadProgress() after a merge. « Effacer ma progression » replaces the online copy.
- Classement: lireScore then scoreAEnvoyer (3 000 first line, +400, 400 new week, ≥ 10 s); page #reviser/classement (XP chip of Réviser, Profil row), cache for offline, « Actualiser » in the top bar (navbarHTML has an `end` slot).
- Questions: #cours/questions (glass « Poser une question » in Cours header, row at the top of the path, row at the bottom of each chapter), sheets ?question= and ?poser=; admin « À répondre » first; two-tap deletes.
- Screens: welcome step « Garde ta progression » (sheet over the welcome with address: null; sheet.js accepts it), Profil card « Mon compte » + « Comment ça marche » row (Réviser's sheet, 3 account lines), « Ce que l'appli garde » texts. css/11-compte.css. Cache promo-mapst-v4.
- Tests (CHROME_PATH for Chromium): test_compte.py (122, fake backend), test_rules.py (24, real backend.js on Firebase emulators: Java + firebase-tools, else SKIP), node tests/test_sync.mjs (28), test_app.py (264), test_lecons.py (66), test_reviser.py (99), test_offline.py (14), test_planning_fixes.py (21), test_check_content.py (58). Three checks made to follow the 13 Nov lessons.
- Owner, after merging: step 6 of docs/firebase/README.md (admins/<pseudo>).
- To watch on a real iPhone: the number keypad on the code fields, staying signed in after closing the installed app, the account sheet over the welcome.
- Dates clés' two-part control has left-aligned labels (the questions one is centred): for the clean-up.
- When adding a code file to the app (css/, js/, img/, vendor/), add it to the list in sw.js (check with scripts/check_offline_list.py). Content files never need it.
