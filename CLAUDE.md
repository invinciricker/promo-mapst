# Promo MAPST

## What it is
A free web app called « Promo MAPST », for the trainees of my BPJEPS MAPST course (multi-activités physiques ou sportives pour tous) at CAPA Sports in Nice, 14 Sept 2026 → 4 June 2027. My classmates use it mostly on their phones (iPhone and Android): they open a link and add the app to their home screen. It is hosted on GitHub Pages from this public repository.

Three modes, one per tab in a bottom bar:
1. Réviser: Duolingo-style quizzes on the course.
2. Étudier: a library for learning things in depth and discovering more, when you're curious and have time.
3. Planning: the course timetable by day, week, month and year.

I'm a beginner. Explain things in plain English, keep it short, and tell me exactly what to click.

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
My private repository invinciricker/Claude-timetable-artefact holds my personal timetable page. Its "Riviera" design becomes the design of the whole app: the sea header with the day's date, Gloock and Albert Sans, floating cards, pebble days, and the dock, which becomes the bottom bar for the three modes. Its README describes the design; site/template.html has the code. That page also uses claude.ai artifact features (Google Calendar, a database): leave them out, this app can't use them.

Use CAPA Sports' colours inside that design:
- navy #103550: sea header and bottom bar
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
I write the real content elsewhere in these exact formats, so keep them. If you need to change one, ask me first.
- content/themes.json: a list of { "id", "title" } in display order.
- content/questions.json: a list of questions with id, theme, lesson (number), type ("qcm", "saisie" or "paires"), question, hint, explanation, study (id of a study page, optional), source and status ("exemple" or "verifie"). A qcm also has choices (list) and correct (list of indexes); a saisie has answers (accepted answers, main one first); a paires has pairs (list of [left, right]).
- content/study/index.json: a list of pages with id, theme, title, minutes, level ("essentiel" or "approfondi"), offProgram (true or false), related (list of ids), source and status. Each page's text is content/study/<id>.md, in Markdown.
- Sample content starts with « [EXEMPLE] » and has status "exemple": 3 questions per theme in Phase 2, 2 pages per theme in Phase 3.

## Phases
1. App shell (three tabs, design, offline install), Planning, and publishing on GitHub Pages. Réviser and Étudier show « Bientôt » until their phase.
2. Réviser.
3. Étudier.
4. Accounts, sync and classement.

## État
(Updated by Claude at the end of each phase.)
