# Phases 1 to 3: the original briefs

Kept for the record, as they stood in `CLAUDE.md` until 12 Nov 2026. They are done. What was really built is in « État » at the bottom of `CLAUDE.md`; where Phase 4 changes something, `docs/phases/phase-4.md` wins.

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
