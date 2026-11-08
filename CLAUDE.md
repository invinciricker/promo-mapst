# Promo MAPST

## What it is
A free web app called « Promo MAPST », for the trainees of my BPJEPS MAPST course (multi-activités physiques ou sportives pour tous) at CAPA Sports in Nice, 14 Sept 2026 → 4 June 2027. My classmates use it mostly on their phones (iPhone and Android): they open a link and add the app to their home screen. It is hosted on GitHub Pages from this public repository.

Four tabs in a bottom bar:
1. Accueil: today's classes and what to revise, under a picture of the Baie des Anges (since Phase 3).
2. Réviser: Duolingo-style quizzes on the course.
3. Étudier: a library for learning things in depth and discovering more, when you're curious and have time (Phase 5).
4. Planning: the course timetable by week, month and year.

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
- A « Profil » page (it replaces the « Infos » screen in Phase 3): source and date of the planning, what the app stores, the footer text.
- README.md in plain English, kept up to date: what each file does, how to add content, how to update the planning, how to publish.
- At the end of each phase: open a pull request, update « État » at the bottom of this file, tell me exactly what to test on my phone, and wait for my go before the next phase.

## Design
Polished, bright and calm: it should feel like a good app from the App Store, because classmates decide in three seconds. Since 7 Nov 2026 the target is docs/design/mockups.html (see « Nouveau look (Phase 3) »). On 6 Nov 2026 I dropped the "Riviera" design of my personal timetable page (in my private repository invinciricker/Claude-timetable-artefact, which still holds the planning data): don't copy it.
- Light or dark mode, following the phone's setting.
- Light surfaces and white cards; CAPA navy is the colour of the text, not of big areas. Accueil opens on a window onto the Baie des Anges that follows the sky of the day.
- A white, translucent tab bar (a side rail on a laptop), pages that slide in with a back button, bottom sheets, short and smooth animations.
- Font: Plus Jakarta Sans, in vendor/fonts. Colours, font and sizes live in css/01-tokens.css, with the values of the mockups.
- Useful comments in the code, and well-structured folders and files that a beginner can follow.

CAPA Sports' colours, mixed with the Nice palette:
- navy #103550: text
- turquoise #00E6BF: main buttons, correct answers, and Réviser
- orange #F09000 (soleil): Accueil, série and XP
- blue #1070B0 (azur): Planning and the courses
- lavande, bougainvillier, olivier, galet and citron: the planning categories and the Réviser themes
Text must stay readable on every colour, in light and dark mode.

## Planning (Phase 1)
Data
- Write scripts/export_planning.py. It reads private/data/planning.json (the official planning of 1 Oct 2026) and private/data/content.json from my private repository, and writes content/planning.json with only what applies to the whole class: hours, place name and content of every half-day; épreuves and dossier deadlines; school holidays (zone B) and public holidays; the stages of the year; the corrections already in content.json (pageFix, holidays, cellNotes).
- Leave out everything about me: my name, contacts (people), addresses, the animanice and recre sections of content.json, my personal events, and any text that mentions me or my own stage. The class-wide « Stage APEC · AnimaNice » of 2 to 20 Nov comes from content/planning-fixes.json (since 7 Nov 2026).
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

**Real questions.**
- content/questions.json now holds 70 real questions with status "brouillon": written by Claude chat from the course, not yet checked by me. The samples are gone.
- Changed on 7 Nov 2026 (Phase 3): everyone sees "brouillon" and "verifie" questions. A lesson is shown once it has at least 5 of them; a theme with nothing to show says « Questions en préparation ».
- Status "exemple" keeps working as before (none are left).

**Relecture mode**, so I can check the questions on my phone:
- A switch in Profil (in Infos until Phase 3), « Mode relecture », off by default, with the line « Pour vérifier les questions et signaler les erreurs. »
- When it's on, "brouillon" questions show an « À vérifier » badge, and every lesson is open.
- After the feedback of a "brouillon" question, two buttons: « Juste » and « À corriger ». « À corriger » asks for an optional one-line note.
- A « Rapport de relecture » screen, reached from Profil while the mode is on: how many questions are checked, the « À corriger » list with notes, « Copier le rapport », and « Effacer le rapport » (two taps).
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

## Nouveau look (Phase 3)
On 7 Nov 2026 I found the app crowded and too dark, so Phase 3 redesigns it before anything new is added. The target is docs/design/mockups.html, explained in docs/design/README.md: match it closely, colours, sizes and spacing included. Where this section and an earlier one disagree, this one wins.

**Principles**
- One job per screen: show what matters now; everything else is one tap away on its own page.
- Bright: light background, white cards, navy for text. Colour comes from the Nice palette, one colour per mode.
- Smaller and lighter type (the scale in the mockups), no capital-letter labels.
- It should feel like an iPhone app: pages slide in from the right with a back button, sheets slide up from the bottom.

**Getting around**
- A white, translucent tab bar with three tabs: Accueil, Réviser, Planning. Étudier is hidden until Phase 5, and so is « Étudier ce thème ».
- A page opened from another one slides in from the right, with « ‹ Previous screen » at the top left. A swipe from the left edge of the screen also goes back; if that gesture feels wrong on a real iPhone, keep only the button and tell me.
- Sheets close with ×, a swipe down, a tap outside or back.
- Every page and sheet has its own address, so Android's back button and the browser's back button work.
- Each tab remembers where you were; tapping the current tab again goes back to its first screen.
- The app opens on Accueil.

**Welcome, first launch only** (mockups 1 and 2)
1. Bienvenue: the dawn scene full screen, « Promo MAPST », « Des leçons de 5 minutes sur tes cours, et le planning de la promo toujours sur toi. », « Commencer », and « Appli non officielle, faite par un stagiaire. ». One short entrance: the title fades in and the sun rises slightly (under 1 s; nothing with reduced motion).
2. « On t'appelle comment ? »: a first name or nickname (20 characters at most), « Continuer », « Passer ». Saved on the phone only.
3. Only when the app is open in a browser and not installed: the install help (the iPhone steps, the Android button), with « Plus tard ».
Then Accueil. Phones that already used the app also see the welcome once. Phase 4 turns step 2 into the account.

**Accueil** (mockups 3, 4 and 13)
- A window onto the Baie des Anges with « Bonjour Sam » (« Bonsoir » from 18:00; « Bonjour » alone without a name), the date, and a round button with the initial that opens Profil. The picture follows the sky of Nice that day, from sunrise and sunset computed in the app, no network (rules and crop in docs/design/README.md). It updates when the app comes back to the screen. #accueil?ciel=aube (or jour, couchant, nuit) forces a sky so I can check all four.
- A card « Aujourd'hui », one of:
  - on a class day: the half-day on now, with a progress bar and « encore 1 h 20 », or the next one; then the one after (« Ensuite »);
  - once today's classes are over: « Fini pour aujourd'hui » and the next half-day;
  - with no class today: « Week-end », the holiday or the day off, then the next half-day with its date.
  Today's personal events appear in it too. An épreuve or dossier due within 14 days adds one line with its J-x. Tapping a half-day opens its details.
- A card « Réviser »: série and XP, the lesson to continue with its ring (4/10), « Continuer » (« Commencer » the first time). In the evening, if no lesson was done today and the série is running: « Une leçon ce soir pour garder ta série. ». When everything is done: « Tout est à jour », and « Mes erreurs » if there are some.
- Nothing else.

**Profil** (mockup 8, the round button on Accueil)
- The first name and « Changer mon prénom »; « Mode relecture », with « Rapport de relecture » under it while the mode is on; « Installer l'appli » when not installed; « À propos du planning » (source, date, corrections, and the notes from « checks » that have no date); « Ce que l'appli garde »; the footer text.
- Profil replaces the Infos screen; old #infos addresses open Profil.

**Planning** (mockups 9 to 11)
- Semaine, Mois, Année. Semaine replaces Jour and Semaine: a strip of the 7 days (a dot per half-day in its category colour, the chosen day filled in azur) and the chosen day's half-days below. Arrows or a swipe on the strip change the week; a swipe on the list changes the day. It opens on today; a day without class says so in one line, with a link to the next class day.
- « Aujourd'hui » and « + » at the top.
- A note from « checks » that has a date shows as a slim citron banner in its week. A half-day with "check": true has a small « À vérifier » tag, and its note in the details.
- Details in a sheet: category, title, date, hours, place, trainer, note, and « Réviser ce thème » when a theme matches.
- Under the day: « Dates clés », a page with every key date by month, J-x on épreuves and dossiers, « À confirmer » where there's a note, and a Tout / Épreuves et dossiers switch; then « Ajouter à ton agenda » (the .ics, as now).
- Mois and Année keep how they work, in the new look. The colour legend opens from a small « Couleurs » button.
- The « En ce moment » card moves to Accueil.

**Réviser** (mockups 5 to 7)
- Home: série and XP; one card with « Continuer » and « Mes erreurs »; the theme tiles with icon, colour, progress bar and « Leçon 1 sur 2 » or « Terminé ». Theme colours follow their order in themes.json (see docs/design/README.md): a new theme gets a colour and a default icon without any code change.
- A theme is a page with its lessons on a vertical path: done, current (ring and play) and locked (« S'ouvre quand la leçon 1 est finie. »), then « D'autres leçons arrivent au fil des cours. ».
- A lesson is full screen: ×, progress bar, lives. The feedback rises from the bottom, turquoise when right and bougainvillier when wrong, with the explanation, the source, « Approfondir » when a study page exists, and « Continuer ». The Relecture buttons stay under it.
- The celebration stays, in the new colours.
- Since 7 Nov 2026 everyone sees "brouillon" questions like "verifie" ones: I'll check them later. The « À vérifier » badge, the « Juste / À corriger » buttons and « every lesson open » stay for Relecture only. Update the summary of check_content.py to match.

**Phone details**
- Status bar: apple-mobile-web-app-status-bar-style "default", because the app is light now (docs/design/README.md says why). theme-color and the manifest colours follow the page background, light and dark.
- A launch image on iPhone (apple-touch-startup-image) for the current iPhone sizes, made by a script from the Bienvenue screen without its button, committed under icons/launch/. On Android, the manifest's background colour does the job.
- On a laptop the tab bar becomes a side rail on the left, and the content sits in a centred column; the Accueil window grows with it.
- The illustrations: copy docs/design/baie-*.svg into the app (img/, for example) and list them in sw.js. If one needs changing, tell me: Claude chat redraws them with docs/design/baie.py.

**Planning corrections.** content/planning-fixes.json (written by Claude chat, format below) holds corrections to the official planning. scripts/export_planning.py must apply them on every run, so that a rebuild never undoes them. The first one (2 to 20 Nov: stage APEC in the AnimaNice, not « MSP 1 au centre de loisirs ») is already applied in content/planning.json and content/planning.ics: running the script must give the same result.

**Tests.** Update the tests for the new screens (they can skip the welcome by saving a first name first), add one for planning-fixes.json, and save screenshots at 390 × 844 of the new screens, light and dark, to compare with the mockups. Run everything before the pull request.

**After Phase 3.** Tell me what to test on my phone: the welcome (and how to see it again), the four skies, dark mode, going back with the button and with the swipe, a week of planning, a lesson.

## Accounts (Phase 4)
- The account takes the place of the « Ton prénom » step of the welcome; the greeting keeps the first name, which stays on the phone.
- Before writing any code, list the exact steps I must do in the Firebase console: free Spark plan, no card, database in an EU region.
- Sign-in with a username and a 6-digit PIN. No email, no real name, nothing else. Use Firebase Authentication's email/password sign-in with an internal address built from the username, never shown to users.
- Refuse obvious PINs (000000, 123456 and the like) and say on screen: « N'utilise pas le code de ta carte bancaire ni celui de ton téléphone. »
- People stay signed in; the PIN is only asked on a new phone.
- Everything keeps working without an account. Signing in uploads the progress already on the phone; on a new phone, it comes back.
- Classement: usernames and XP of the week. Each person chooses whether to appear. Only people with the class code, which I'll share in our group, can create a profile.
- Firestore security rules: nobody can read or change someone else's progress, and absurd values such as huge XP jumps are refused. Write the rules, test them if you can, and explain them to me simply.
- Forgotten PIN: I must be able to let the person choose a new PIN without losing their progress. Design for that and tell me the steps.
- A « Supprimer mon compte » button that deletes the account and its data.

## Étudier (Phase 5)
- Its tab (lavande) comes back between Réviser and Planning, with « Étudier ce thème » in the planning details.
- A library grouped by the same themes. Each page has a title, reading time, level (Essentiel or Approfondi), short sections, an « À retenir » box, a « Le savais-tu ? » fact, diagrams where they help, « Pour aller plus loin » links to related pages, and « Teste-toi », which starts the questions linked to the page.
- A « Hors programme » badge marks pages that go beyond the course: discovery, not exam material.
- « Découvrir » opens a random page I haven't read. Search across all pages. Pages read are tracked, and « Continuer » brings me back where I stopped.
- Images: only SVG diagrams made for the app, or public-domain or Creative Commons images with credit. Never images from course documents.

## Content formats
Claude chat writes the real content in these exact formats, so keep them. If you need to change one, ask me first.
- content/themes.json: a list of { "id", "title" } in display order, with optional "lessons": a list of { "n", "title" } (lesson number and title).
- content/questions.json: a list of questions with id, theme, lesson (number), type ("qcm", "saisie" or "paires"), question, hint, explanation, study (id of a study page, optional), source and status ("brouillon": written by Claude chat, not checked yet; "verifie": checked by me, visible to everyone; "exemple": sample). A qcm also has choices (list) and correct (list of indexes); a saisie has answers (accepted answers, main one first); a paires has pairs (list of [left, right]).
- content/study/index.json: a list of pages with id, theme, title, minutes, level ("essentiel" or "approfondi"), offProgram (true or false), related (list of ids), source and status. Each page's text is content/study/<id>.md, in Markdown.
- content/planning-fixes.json: { "about", "fixes": [ … ] }. Each fix has id, added (date), from and to (dates), match (the fields a half-day must have, for example { "planning": "MSP 1" }), set (the fields that replace them), and optional stage (new title and text for the stage that starts on "from"), check (a note added to checks if it isn't there yet), category (new label and desc for that category id) and why (for humans).
- Sample content starts with « [EXEMPLE] » and has status "exemple". Réviser has real questions since 6 Nov 2026. In Phase 5, Claude chat provides the real study pages; use 2 sample pages per theme only if they aren't there yet.

## Phases
1. App shell (tabs, design, offline install), Planning, and publishing on GitHub Pages.
2. Réviser.
3. Nouveau look: Accueil, the welcome, the new design everywhere.
4. Accounts, sync and classement.
5. Étudier.

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
