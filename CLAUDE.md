# Promo MAPST

## What it is
A free web app called « Promo MAPST », for the trainees of my BPJEPS MAPST course (multi-activités physiques ou sportives pour tous) at CAPA Sports in Nice, 14 Sept 2026 → 4 June 2027. My classmates use it mostly on their phones (iPhone and Android): they open a link and add the app to their home screen. It is hosted on GitHub Pages from this public repository.

Three modes, one per tab in a bottom bar:
1. Réviser: Duolingo-style quizzes on the course.
2. Étudier: a library for learning things in depth and discovering more, when you're curious and have time.
3. Planning: the course timetable by day, week, month and year.

I'm a beginner. Explain things in plain English, keep it short, and tell me exactly what to click.

## Who does what
- **Claude chat** (my claude.ai Project « BPJEPS MAPST », which holds the course files) plans each phase, writes everything in content/ and docs/, writes the phase specs in this file, and gives me the prompt for each Claude Code session. It never touches code, and it only pushes to branches named chat/….
- **Claude Code** writes all the code: index.html, css/, js/, sw.js, the manifest, scripts/, tests/, .github/, vendor/ and README.md, and updates « État » below. It never edits content/ or docs/: if a question or a page looks wrong or breaks a rule, list it in the pull request instead.
- **I** decide, test on my phone, check the questions in Relecture mode and merge.
- Nothing reaches main except through a pull request that I merge.
- How the work flows, and every decision so far: docs/PLAN.md. What content exists, where it comes from and what comes next: docs/CONTENT.md.

## Rules for the whole app
- Everything the user sees is in French.
- Plain HTML, CSS and JavaScript, no framework. No build step for the site: GitHub Pages serves the committed files as they are. Scripts may prepare files (data, downloaded libraries) as long as the result is committed.
- Libraries and fonts live in vendor/. Nothing loads from a CDN at runtime.
- Installable app (PWA) that works offline after the first visit. When I publish an update, phones get the new version and the new content by themselves.
- Mobile first, comfortable on a laptop too. Light and dark mode.
- No analytics, cookies, ads or trackers.
- All content lives in data files under content/ (formats below), never in the code.
- This repository is public. Never commit personal data, course PDFs, slides or photos.
- No CAPA Sports logo, and no Duolingo name, logo or mascot. Footer: « Application non officielle créée par un stagiaire. En cas de doute, vérifie dans tes cours. »
- An « Infos » screen: source and date of the planning, what the app stores, the footer text.
- README.md in plain English, kept up to date: what each file does, how to add content, how to update the planning, how to publish.
- At the end of each phase: open a pull request, update « État » at the bottom of this file, tell me exactly what to test on my phone, and wait for my go before the next phase.

## Design
Polished and inviting, nice to look at and to use: it should feel like a good app from the App Store. On 6 Nov 2026 I dropped the "Riviera" design of my personal timetable page (in my private repository invinciricker/Claude-timetable-artefact, which still holds the planning data): don't copy it.
- Light or dark mode, following the phone's setting.
- Navy header with the day's date, floating cards, a navy bottom bar for the three modes (a side bar on a laptop), smooth animations and bottom sheets.
- Font: Plus Jakarta Sans, in vendor/fonts. Colours, font and sizes live in css/01-tokens.css.
- Useful comments in the code, and well-structured folders and files that a beginner can follow.

Use CAPA Sports' colours, mixed and matched:
- navy #103550: header and bottom bar
- turquoise #00E6BF: correct answers and main buttons
- orange #F09000: streak and XP
- blue #1070B0: the Azur category (courses)
Text must stay readable on every colour, in light and dark mode.

## Planning (Phase 1)
Data
- Write scripts/export_planning.py. It reads private/data/planning.json (the official planning of 1 Oct 2026) and private/data/content.json from my private repository, and writes content/planning.json with only what applies to the whole class: hours, place name and content of every half-day; épreuves and dossier deadlines; school holidays (zone B) and public holidays; the stages of the year; the corrections already in content.json (pageFix, holidays, cellNotes).
- Leave out everything about me: my name, contacts (people), addresses, animanice, recre, my personal events, and any text that mentions me or my stage. From 2 to 20 Nov, show what the official planning says (MSP 1 · Ville de Nice).
- Trainers: initials only, because this repository is public. Keep labels like « Ville de Nice » and « Évaluateurs ».
- Never copy private/sources/ or private/recre-aventure.jpg.
- Before committing content/planning.json, show me what you kept and what you dropped.
- If you can't open my private repository from this session, say so and stop.

Views
- Jour, Semaine, Mois and Année, as a segmented control. Opens on today. Swipe or arrows to move, and an « Aujourd'hui » button.
- A card for what's on now or next, with a progress bar and « encore X », like my page.
- Each half-day shows hours, place, topic and trainer initials; tapping it opens the details.
- Année: September to June, each day a pebble coloured by its main activity.
- Highlights: today; épreuves and dossier deadlines with a J-x countdown; holidays and days off; Ville de Nice / MSP periods; « à vérifier » notes.
- Colours: my page's Nice-named categories (Azur, Olivier, Lavande, Bougainvillier, Galet), Citron for personal events, and a legend.
- « + » adds a personal event, saved on the phone only (synced to the account from Phase 4).
- A button exports the planning as an .ics file for Google Calendar or Apple Calendar.
- When a class's topic matches a theme of Réviser or Étudier, its details offer « Réviser ce thème » and « Étudier ce thème ». Map the planning's topics to the themes; the topics in content.json help.

## Réviser (Phase 2)
- Themes come from content/themes.json: Anatomie et mouvement · Filières énergétiques · Les publics et leurs caractéristiques · Activités d'entretien corporel · Rôle et obligations de l'éducateur sportif · La fiche de séance. More can be added in that file.
- Each theme is a path of short lessons of 8–10 questions that unlock in order.
- Three question types:
  1. QCM: 4 options with plausible wrong answers. Demanding, not answerable half-asleep. Some have several correct answers, and the screen then says « Plusieurs réponses possibles ».
  2. Réponse à taper: an « Indice » button shows a clue (a mnemonic, for example) that never gives the answer away. Ignore capitals and accents, accept the alternatives listed in the data, and tolerate one typo only in answers of 8 letters or more.
  3. Associer: match 4 pairs.
- After each answer: right or wrong straight away, a one-sentence explanation, and « Approfondir » when a study page is linked.
- XP, a daily streak (« série »), 3 lives per lesson (losing all 3 restarts it), a progress bar per theme, and a short celebration at the end of a lesson.
- « Mes erreurs »: questions answered wrong come back sooner.
- Progress is saved on the phone (synced to the account from Phase 4).

### Phase 2 additions (6 Nov 2026, prepared by Claude chat, approved by me)
**Start from the draft.** The branch chat/phase-2 holds a draft of Réviser that Claude chat wrote on 6 Nov, before the split above was agreed: js/reviser/, css/07-reviser.css, scripts/check_content.py, tests/test_reviser.py, and changes to index.html, js/app.js, js/screens/infos.js, js/screens/soon.js, sw.js and css/01-tokens.css. Its test passed 25/25 with the old sample questions. Review it as if a colleague wrote it: keep what's good, fix what isn't. From now on you own all of it.

**Real questions, hidden until checked.**
- content/questions.json now holds 70 real questions with status "brouillon": written by Claude chat from the course, not yet checked by me. The samples are gone.
- Classmates only see questions with status "verifie". A lesson is shown once it has at least 5 of them; a theme with nothing to show says « Questions en préparation ».
- Status "exemple" keeps working as before (none are left).

**Relecture mode**, so I can check the questions on my phone:
- A switch in Infos, « Mode relecture », off by default, with the line « Affiche les questions pas encore vérifiées. Elles peuvent contenir des erreurs. »
- When it's on, "brouillon" questions appear in their lessons with an « À vérifier » badge, and every lesson is open.
- After the feedback of a "brouillon" question, two buttons: « Juste » and « À corriger ». « À corriger » asks for an optional one-line note.
- A « Rapport de relecture » screen, reached from Infos while the mode is on: how many questions are checked, the « À corriger » list with notes, « Copier le rapport », and « Effacer le rapport » (two taps).
- The copied report is short plain text that I paste into Claude chat, for example:
      Relecture Promo MAPST · 7 nov. 2026
      À corriger (2) :
      - anat-1-04 : la réponse C est aussi juste
      - fil-1-07
      Juste (18) : anat-1-01, anat-1-02, …
- Verdicts are saved on the phone, keyed by question id plus a short fingerprint of its text, choices and answers: when Claude chat changes a question, its old verdict disappears.

**Content without code.**
- Adding or changing questions, lesson titles and, later, study pages must never require editing code or sw.js.
- content/ files are fetched network-first, with the cached copy as the offline fallback.
- Progress is keyed by question id. Ids never change; progress for an id that no longer exists is ignored.
- Typography is the app's job: when showing content, put a no-break space before ? ! : ; » and after «, so a line never starts with punctuation. The data keeps plain spaces.

**Lesson titles.** A theme in themes.json may have "lessons": [{ "n": 1, "title": "Os et articulations" }]. Show the title on the path and at the top of the lesson; without one, « Leçon N ».

**Automatic checks.**
- A GitHub Actions workflow runs scripts/check_content.py and scripts/check_offline_list.py on every pull request and every push to main. Tell me what a red cross on a pull request looks like and what to do about it.
- check_content.py also checks that lesson numbers start at 1 without gaps, that a « Réponse à taper » hint never contains an accepted answer, and that lesson titles match existing lessons (a warning only).

**Tests.** tests/test_reviser.py still assumes the old samples (3 questions per lesson, the samples note). Update it for the real content and the new rules (it must switch Relecture on to see "brouillon" questions), and run it before opening the pull request.

**After Phase 2.** Tell me how to switch on Relecture, check lesson 1 of each theme and send the report to Claude chat.

## Étudier (Phase 3)
- A library grouped by the same themes. Each page has a title, reading time, level (Essentiel or Approfondi), short sections, an « À retenir » box, a « Le savais-tu ? » fact, diagrams where they help, « Pour aller plus loin » links to related pages, and « Teste-toi », which starts the questions linked to the page.
- A « Hors programme » badge marks pages that go beyond the course: discovery, not exam material.
- « Découvrir » opens a random page I haven't read. Search across all pages. Pages read are tracked, and « Continuer » brings me back where I stopped.
- Images: only SVG diagrams made for the app, or public-domain or Creative Commons images with credit. Never images from course documents.

## Accounts (Phase 4)
- Before writing any code, list the exact steps I must do in the Firebase console: free Spark plan, no card, database in an EU region.
- Sign-in with a username and a 6-digit PIN. No email, no real name, nothing else. Use Firebase Authentication's email/password sign-in with an internal address built from the username, never shown to users.
- Refuse obvious PINs (000000, 123456 and the like) and say on screen: « N'utilise pas le code de ta carte bancaire ni celui de ton téléphone. »
- People stay signed in; the PIN is only asked on a new phone.
- Everything keeps working without an account. Signing in uploads the progress already on the phone; on a new phone, it comes back.
- Classement: usernames and XP of the week. Each person chooses whether to appear. Only people with the class code, which I'll share in our group, can create a profile.
- Firestore security rules: nobody can read or change someone else's progress, and absurd values such as huge XP jumps are refused. Write the rules, test them if you can, and explain them to me simply.
- Forgotten PIN: I must be able to let the person choose a new PIN without losing their progress. Design for that and tell me the steps.
- A « Supprimer mon compte » button that deletes the account and its data.

## Content formats
Claude chat writes the real content in these exact formats, so keep them. If you need to change one, ask me first.
- content/themes.json: a list of { "id", "title" } in display order, with optional "lessons": a list of { "n", "title" } (lesson number and title).
- content/questions.json: a list of questions with id, theme, lesson (number), type ("qcm", "saisie" or "paires"), question, hint, explanation, study (id of a study page, optional), source and status ("brouillon": written by Claude chat, not checked yet; "verifie": checked by me, visible to everyone; "exemple": sample). A qcm also has choices (list) and correct (list of indexes); a saisie has answers (accepted answers, main one first); a paires has pairs (list of [left, right]).
- content/study/index.json: a list of pages with id, theme, title, minutes, level ("essentiel" or "approfondi"), offProgram (true or false), related (list of ids), source and status. Each page's text is content/study/<id>.md, in Markdown.
- Sample content starts with « [EXEMPLE] » and has status "exemple". Réviser has real questions since 6 Nov 2026. In Phase 3, Claude chat provides the real study pages; use 2 sample pages per theme only if they aren't there yet.

## Phases
1. App shell (three tabs, design, offline install), Planning, and publishing on GitHub Pages. Réviser and Étudier show « Bientôt » until their phase.
2. Réviser.
3. Étudier.
4. Accounts, sync and classement.

## État
(Updated by Claude at the end of each phase.)

**6 Nov 2026: Phase 2 done, in a pull request (it includes chat/phase-2), waiting for the go before Phase 3.** Phase 1 was merged on 6 Nov 2026.
- Réviser: themes and lesson titles from content/themes.json; per theme a path of lessons that unlock in order; QCM (« Plusieurs réponses possibles », ✓ and × after the answer), Réponse à taper (« Indice », capitals and accents ignored, one typo forgiven from 8 letters), Associer (4 pairs; the rows line up after the answer); feedback with explanation and source; « Approfondir » is ready for Phase 3 (shown only when a study page exists). XP: 10 first try, 5 after a mistake, +10 without mistake, 5 in a review. Série, 3 lives (losing all 3 restarts), celebration, « Mes erreurs » (boxes: same day, then 1, 3 and 7 days).
- Who sees what: "verifie" for everyone once a lesson has at least 5 (MIN_CHECKED in js/reviser/content.js); "exemple" for everyone with a badge; "brouillon" only in Relecture, where every lesson is open. Today all 70 questions are "brouillon": classmates see « Questions en préparation ».
- Relecture: switch in Infos (localStorage promo-mapst:relecture-mode). After a "brouillon" question: « Juste » / « À corriger » (optional one-line note); the letters A–D of the file appear on the choices once answered. « Rapport de relecture » (#infos/relecture): counts, the « À corriger » list (notes can be edited), progress per lesson, « Copier le rapport », « Effacer le rapport » (two taps). Verdicts in promo-mapst:relecture, keyed by id + fingerprint of text, choices, answers, hint and explanation.
- Progress: promo-mapst:reviser, keyed by question id (done: 2 = right first time, 1 = after a mistake). Unknown ids are ignored; new questions in a finished lesson show « Nouveau » without locking the next lesson.
- Content without code: sw.js saves any content/ file when it is fetched (network first, 4 s, saved copy offline); scripts/check_offline_list.py only requires code files to be listed.
- Checks: .github/workflows/checks.yml runs scripts/check_content.py and scripts/check_offline_list.py on every pull request and push to main. check_content.py also checks lessons numbered from 1 without gaps and typed-answer hints that contain an accepted answer (problems), and warns about lesson titles without questions and wrong answers one typo away from a right one.
- Tests (run before each pull request): tests/test_reviser.py, tests/test_check_content.py, tests/test_offline.py (Python Playwright). See README « Tests ».
- Planning (Phase 1, unchanged): Jour, Semaine, Mois, Année; « En ce moment » card; details with « Réviser / Étudier ce thème » (keywords in content/planning-themes.json); personal events « + » (localStorage promo-mapst:events); « Ajouter à ton agenda » (content/planning.ics). Data from scripts/export_planning.py (planning of 1 Oct 2026, corrections of 4 Nov 2026). Approved: Lavande = « Préparation »; trainers as initials.
- To do once, if not done yet: switch on GitHub Pages (Settings › Pages › main, / (root)), see README.
- When adding a code file to the app, add it to the list in sw.js (check with scripts/check_offline_list.py). Content files never need it.
