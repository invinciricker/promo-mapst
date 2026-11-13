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

**13 Nov 2026: Phase 5 (« Les leçons ») done, in a pull request, waiting for the go before Phase 6.** Phases 1 to 4 are in main. Everything technical is in docs/TECH.md (« The lessons of Cours »).
- Lessons: js/cours/markdown.js reads content/lecons/<id>.md into cards (`## ` = a card; paragraphs, **bold**, `- `/`1. ` lists, table, the four boxes, question `?` + `- [x]`/`- [ ]` + `=`, picture `img/…`); anything else is plain text. The same rules are in Python in scripts/check_content.py: change both together.
- js/cours/lecons.js: index.json → lessons (skipped if broken), texts fetched on demand and prefetched 1.5 s after start (pictures too), saved progress `promo-mapst:lecons` { id: { at, read } } (reading the last card sets read and at = 0).
- js/cours/lecon.js + css/10-lecons.css: the lesson, full screen over its chapter, `#cours/<chapitre>?lecon=<id>`. nav.js registerModal now takes { tab }: `?lecon=` is a card lesson in Cours and a quiz lesson elsewhere. Top row on --grad-cours, one segment per card plus the end card. Right 2/3 or swipe left or → : next; left 1/3, swipe right or ← : back; 420 ms --ease-page like pages. A question blocks forward until answered (cards passed in an earlier visit don't). End card: « Leçon terminée », « Teste-toi » (theme), « Retour au chapitre ». html classes has-player + has-lecon (status bar --top-cours).
- Cours (js/cours/cours.js, content.js): every bloc and chapter; `.chap.is-empty` (no lesson, no theme) washed out with « Bientôt »; pills « N leçons » (`.pill--done` when all read), « Quiz x/y »; a `.gcard` to the next unread lesson (« Commencer » / « Continuer »). Chapter page: `.lesson-row`s, « Réviser ce chapitre », « Documents » (`.docs-locked` while none). Header sentence: « Chaque étape a ses leçons et son quiz. »
- Relecture: lesson verdicts saved under `lecon:<id>` (fingerprint of title + text, verdict.js and relecture.js accept a `verdictKey`); the report adds « Leçons » after the questions when one lesson has a verdict; the Rapport page has a « Leçons » list.
- Année: round dots with the date number (10 px / 700), 22 px at least, so the months use `auto-fill, minmax(198px)`: one month per row on most phones. Personal-event days (citron) get navy numbers.
- Offline: sw.js reads content/lecons/index.json at install and saves every lesson listed; nothing is listed by hand. Cache still promo-mapst-v3.
- Profil › « Ce que l'appli garde » mentions the lessons.
- Phase 4 frame unchanged: tokens (css/01-tokens.css), app feel (02-base.css), nav.js tabs/pages/modals, Accueil's living sky, Planning, install help.
- Tests (CHROME_PATH for Chromium): test_app.py (262), test_lecons.py (66, new), test_reviser.py (98–99, the count depends on the random questions), test_offline.py (14), test_planning_fixes.py (21), test_check_content.py (58). Screenshots 390 × 844, light and dark. Two random-order bugs of test_reviser.py fixed (pairs before any QCM; « Mes erreurs » emptied by the restart).
- To watch on a real iPhone: swiping cards (Safari's own back swipe outside the installed app), selecting text by long press in a lesson, the length of Année.
- When adding a code file to the app (css/, js/, img/), add it to the list in sw.js (check with scripts/check_offline_list.py). Content files never need it.
