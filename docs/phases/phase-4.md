# Phase 4: « Une vraie appli »

Written by Claude chat on 12 Nov 2026, revised the same evening after the owner tried the prototype (Accueil stripped down, Cours as a path of chapters, bigger day cards in Planning, a sea that really moves). This is the whole brief for the phase: every design decision is already taken here and in `docs/design/prototype.html`. Build exactly this. If something is missing or contradictory, take the simplest option that matches the prototype and list it in the pull request under « Choix faits »; don't stop to ask.

## Why

The owner tested Phase 3 on his iPhone: it still feels like a website, and Accueil feels like a second page instead of a home. The app is used almost only as an installed phone app, so that is where the effort goes. He also wants a fourth tab for the course documents, more colour and translucency, and movement.

## What to open first

1. `docs/design/prototype.html`, through a local server (`python3 -m http.server 8000`, then `/docs/design/prototype.html`). It works: change tab, scroll, tap a theme in Réviser, tap « Installer l'appli ». Try `?ciel=aube|jour|couchant|nuit` and `&installe`.
2. Its `<style>` is numbered 1 to 8. Blocks 1 to 7 are the design: **copy them, with their class names and values**. Block 8 and the `<script>` are only for the prototype.
3. `docs/design/mockups.html` (Phase 3) stays the reference for the inside of the screens this phase doesn't redraw: the lesson path, a question, the sheets, Dates clés, Profil.

## Where the prototype's CSS goes

| Prototype block | Goes to | Notes |
|---|---|---|
| 1. Tokens, « new in Phase 4 » | `css/01-tokens.css` | Add; the Phase 3 tokens don't change. Dark values included. |
| 2. App feel | `css/02-base.css` | See « App feel » below. |
| 3. Changing tab | `css/04-layout.css` | |
| 4. Tab bar | `css/04-layout.css` | Replaces the Phase 3 tab bar on phones. The laptop side rail stays as it is. |
| 5. Accueil | `css/06-screens.css` (or a new `css/08-accueil.css`, listed in `sw.js`) | Replaces the Phase 3 Accueil styles (`.hero`, the two cards). |
| 6. Other tabs | `css/04-layout.css` + each screen's file | `.hd`, `.body`, `.topbar`, the `g…` glass controls, the tinted `.tile`. |
| 7. Pages and sheets | `css/04-layout.css` | Only the look: `js/core/nav.js` keeps moving them. |

## 1. The frame of the app

- **Status bar.** Back to `apple-mobile-web-app-status-bar-style` `black-translucent` in `index.html`: the app draws under the clock, which is white. So **the top of every screen must be coloured**:
  - Accueil: the sky, with `.home__shade`.
  - Cours, Réviser, Planning: their header `.hd`, then `.topbar` once it has scrolled away.
  - Every page opened from a tab (theme, Dates clés, Profil and its pages, Rapport de relecture): `.topbar.topbar--page` with the gradient of its tab: `m-cours`, `m-reviser`, `m-planning`, and `m-accueil` (a warm amber, `--grad-accueil`) for Profil and its pages.
  - The lesson (full screen): its top row (×, progress, lives) sits on `--grad-reviser`, in white; the progress track is `rgba(255,255,255,.28)`, its fill white.
  - The welcome: the sky, plus the same `.home__shade`.
  - Sheets: nothing to do (the scrim darkens the top).
- **theme-color** (Android's status bar) follows the screen: `#7E9EC4` aube, `#3F86BD` jour, `#4A3A80` couchant, `#0A1C30` nuit on Accueil; `--top-cours`, `--top-reviser`, `--top-planning` elsewhere (light and dark values in the tokens). Manifest: `theme_color` `#0A5489`, `background_color` unchanged.
- **Nothing scrolls except the inside of a view.** `html` and `body` never scroll; each tab and each page is its own scroller and keeps its scroll position when you come back. Every scroller ends with `padding-bottom: var(--tabbar-space)` so nothing hides behind the floating bar.
- **Safe areas** come from `--safe-top` and `--safe-bottom` (tokens). Don't hard-code 47 or 34.

## 2. The tab bar

- Four tabs, in this order: **Accueil, Cours, Réviser, Planning** (icons `home`, `book`, `bolt`, `cal`; colours soleil, lavande, turquoise, azur).
- Floating glass capsule with a « lens » that slides under the active icon (prototype block 4). On Accueil at night it turns to dark glass (the rules are in block 4).
- Hidden during the welcome and the lesson, as today.
- Tapping the active tab: back to its first screen, scrolled to the top (already the case).
- `navigator.vibrate(8)` on a tab change, when the browser has it.

## 3. Changing tab

- Order of the tabs: `["accueil", "cours", "reviser", "planning"]`. Going to a tab further right, the new view comes from the right (`--dir: 1`), otherwise from the left (`--dir: -1`). Classes `is-entering` and `is-leaving` (block 3).
- In each tab's first screen, give the first 6 blocks of content the class `rise` and `--i: 0…5`: they come up one after the other.
- Pages keep their Phase 3 slide. Back by swipe or button: unchanged.
- `prefers-reduced-motion`: no movement at all (the rule is at the end of block 7).

## 4. Accueil

Rebuild it as in the prototype. One fixed screen, no scrolling, and almost nothing on it: the picture, the greeting, « le mot », « En ce moment ».

- **The sky.** The SVG goes **inline** (fetch `img/baie-<ciel>.svg`, insert it, remove `width`/`height`, set `preserveAspectRatio="xMidYMax slice"`), so its parts can move. `docs/design/baie-*.svg` changed (clouds, rows of crests on the sea, classes on the moving parts): copy the four again into `img/`. Which sky: `js/core/sun.js`, unchanged. When the sky changes while the app is open, cross-fade (900 ms). `#accueil?ciel=` still forces one.
- **The living scene** (block 5, copy the rules and the keyframes as they are). It must read as a short film on a loop, with three speeds: the clouds drift slowly across and come back on the other side, the boat sails a little faster, and the sea is the fastest (each row of crests `b-swell` slides by exactly one crest, `--s`, in `--t` seconds; both are written on the element by `baie.py`). Runs only while Accueil is the visible tab and the page is visible.
- **Opening**: the class `is-opening` (block 5) once per launch of the app, removed after 2.2 s.
- **Top left**: « Bonjour Sam » / « Bonsoir Sam » (from 18:00; each word in its own `span` with `--i`), the date, and, only while the app isn't installed, the pill « Installer l'appli ». **Top right**: the round glass button with the initial, which opens Profil.
- **Text colour on the sky**: navy at aube and jour, white at couchant and nuit (the `data-ciel` rules of block 5). Glass is light, and dark at night.
- **The dock**, just above the tab bar, two things only:
  1. **« Le mot »** (`.mot`): one short line in barely-there glass. Data: `content/mots.json` (the owner's lines: motivation, things heard in class) and `content/savais-tu.json` (course facts). If `mots` has lines, alternate: one mot, one fact; if it is empty, facts only. The small label above the text is the mot's `label` (default « Le mot du jour », with « · author » when `by` is set) or « Le savais-tu ? » for a fact. Start at an index that depends on the date; change every 9 s (8.6 s shown, 0.4 s fade); words arrive one by one (`.mot .w`). Tapping a fact opens its theme in Réviser; tapping a mot does nothing. It stops while Accueil isn't visible. Reduced motion: one line, no rotation.
  2. **« En ce moment »** (`.now`), with what `js/planning/today.js` already works out:
     | State | Label (left) | Right | Title, place | Bar |
     |---|---|---|---|---|
     | a half-day is on | « En ce moment » with the pulsing dot | « encore 2 h 15 » | its title, its place | progress, with start and end times |
     | next half-day is today | « Ensuite » | « à 13:00 » | title, place | none |
     | today's classes are over | « Fini pour aujourd'hui » | « demain 9:00 » (or the day's name) | the next half-day's title, place | none |
     | no class today | « Week-end », the holiday's or the day off's name | « lundi 9:00 » | the next half-day's title, place | none |
     Under it, at most one extra line, in this order of priority: an épreuve or dossier within 14 days (« Dossier BC3 à rendre · J-5 »), else today's personal event (« Aussi aujourd'hui : Dentiste, 18:00 », and « +1 » if there are more). Tapping the card opens the details of that half-day. The dot and the bar take the category colour.
- **Removed from Accueil**: the XP and série chips, the lesson ring, the Réviser card, any shortcut to another tab (the tab bar does that).
- Phones less than 720 px tall: the rule in block 5 lifts the horizon. On a laptop the sky fills the content column, full height.

## 5. Cours (the new tab)

Address `#cours`. Mode class `m-cours`. The owner's idea: classmates shouldn't have to open the course documents. Cours is the programme as a **path of chapters, in the order of the year**, each tagged with its bloc de compétences; the documents are a button inside each chapter. The fun lessons themselves (« fiches ») arrive in Phase 6.

- Data: `content/parcours.json` (blocs and chapters, in order) and `content/documents.json` (formats in `CLAUDE.md`).
- First screen, as in the prototype: header with « Cours », the sentence, and the filter chips `.filters`: « Tout », then one per bloc that has at least one chapter (its `short`). A filter hides the other chapters; the numbers stay those of the full path.
- Body: the path `.path`. One `.chap` per chapter: its number in the path, « Septembre · BC3 » (`when` and the bloc's `short`), title, `resume`, then pills:
  - when the chapter has a `theme`: « Quiz 7/10 » (questions answered right in that theme, over its total; « Quiz » alone before the first one). It opens that theme in Réviser.
  - when it has documents: « 3 documents ».
  - « Fiche bientôt » (grey), always, until Phase 6.
  Chapter colours: the colour of its theme in Réviser; without a theme, the next colour of the same list.
- A chapter opens a page (`#cours/<id>`, `.topbar--page`): title, « when · bloc title », the `resume`; a main button « Réviser ce chapitre » (when it has a theme); then « Documents » as a list: the kind in a small coloured square (`pdf` → « PDF », `diapo` → « DIAPO », `tableur` → « XLS », `doc` → « DOC », `video` → « VIDÉO », `lien` → « LIEN »), the title, the note under it, « Nouveau » for 7 days after `added`. A document opens `url` in the browser (`target="_blank" rel="noopener"`). No documents yet: « Les documents de ce chapitre arrivent bientôt. »
- At the end of the path: a row « Tous les documents » (`#cours/documents`: every document, grouped by chapter, then « Général » for `"chapitre": "general"`, with a search field from 8 documents), shown only when there is at least one document; and « Ouvrir le dossier Drive » when `folder` is set.
- Links to it: in a half-day's details, « Voir le chapitre » under « Réviser ce thème » when a chapter has that theme. « Étudier ce thème » stays hidden.

## 6. Réviser

- A row « Documents du chapitre » at the bottom of a theme's page, when a chapter has that theme.
- First screen as in the prototype: header `.hd` with « Réviser », the série and XP chips (`.gchip`), and the glass card `.gcard`: the lesson to continue (ring, title, « Continuer la leçon » / « Commencer », play button). When everything is done: the card says « Tout est à jour » with a check instead of the play button.
- Body: the row « Mes erreurs » **only when there are some**; then « Thèmes » with the tinted tiles (block 6: wash of the theme colour, big faint icon).
- Theme page and Rapport de relecture: `.topbar--page`. Their content: unchanged.
- The lesson: its top row on the Réviser gradient (see « Status bar »). Everything else unchanged.
- Vibration when the browser has it: `10` on a right answer, `[20, 40, 20]` on a wrong one. Respect the sound setting that already exists (`js/reviser/sound.js`): no vibration when sounds are off.

## 7. Planning

- Header `.hd.hd--lift`: « Planning », « Aujourd'hui » (`.gchip`) and « + » (`.gbtn`), the segmented control `.gseg`, then the label of the period with the two arrows (« 9 – 15 novembre », « Novembre 2026 », « 2026 – 2027 »).
- **Semaine**, from top to bottom, as in the prototype:
  1. The strip `.days`: one card `.dcard` per day, half on the header, sliding sideways with snap; the chosen day is `.on` (blue, raised) and is brought to the middle. A card shows « jeu. », the date, a label, and two small bars for the morning and the afternoon in their category colours (one bar missing = that half is free). The label: the `short` of the day's first half-day; the holiday's or day off's short name (« Férié », « Vacances »); « Repos » on a week-end without class. Days without class are `.off`. Tapping a card chooses the day; swiping the list below still changes the day, and the arrows the week.
  2. The title: « Aujourd'hui » with the date small on the right (or the day's name, « Jeudi 12 novembre », when it isn't today).
  3. The half-days as cards `.slot` (time, colour bar, title, place); the one that is on gets `.is-now`: the tag « En cours », « encore 2 h 15 » and a thin progress bar. A day without class says so in one card, with the link to the next class day.
  4. The citron banner of the week, when there is one.
  5. « Dates clés », then « Ajouter à ton agenda ».
- Mois: the month grid is a white card that straddles the header (`.body--lift`). Année: nothing straddles (`.hd` without `hd--lift`).
- « Couleurs »: only in Mois and Année, as a small chip above the grid, on the right.
- Details, sheets, Dates clés: unchanged.

## 8. Installing

Apple gives websites no way to install themselves: on iPhone the person has to do it from Safari's menu. So the app guides them as well as it can.

- **Where**: the pill on Accueil while the app isn't installed, the last step of the welcome, and Profil › « Installer l'appli ». All three open the same sheet.
- **iPhone, in Safari**: the three steps of the prototype's sheet, word for word. On iPad, « en haut » instead of « en bas ».
- **iPhone, in another browser** (Chrome, Firefox, Edge: `CriOS`, `FxiOS`, `EdgiOS` in the user agent): step 1 becomes « Touche le bouton Partager de ton navigateur. ».
- **Inside another app's browser** (user agent contains `Instagram`, `FBAN`, `FBAV`, `Snapchat`, `TikTok`, `Line/`, `LinkedInApp` or `WhatsApp`): the sheet says first « Ouvre ce lien dans Safari pour installer l'appli. » with a button « Copier le lien », then the steps.
- **Android**: when the browser offers its own window (`beforeinstallprompt`), the pill and the button open it directly. Otherwise: « Touche ⋮ en haut de Chrome, puis "Installer l'application" ».
- Installed (`isInstalled()`): none of this is shown.

## 9. App feel

Small things, but together they are what makes it stop feeling like a website. All of block 2, plus:

- Nothing in the interface can be selected or long-pressed (`user-select: none`, `-webkit-touch-callout: none`), **except** the text of a question, its explanation, and form fields.
- Every tappable thing has the class `tap` (or the same rule): it answers the finger at once. No style that depends on `:hover` outside `@media (hover: hover)`.
- No grey flash on tap, no double-tap zoom (`touch-action: manipulation`), no pull-to-refresh or rubber band on the whole page (`overscroll-behavior: none` on `html`, `contain` on scrollers).
- Focus rings only with a keyboard (`:focus-visible`).
- Only `transform` and `opacity` are animated. The three durations and two curves of the tokens, nothing else.
- `sw.js`: bump the cache name, list the new files.

## 10. Words for humans

The owner can't read long technical texts, so:

- **`README.md`** is now short and for humans (Claude chat rewrote it). Keep it that way: update the table of tabs and nothing else. All technical detail lives in **`docs/TECH.md`** (the old README, moved): update it for this phase.
- **Pull request descriptions** start with, in this order: « En bref » (3 to 5 plain sentences, no file names), « À tester sur ton téléphone » (a short checklist), « Choix faits » (only if there are any). Then everything technical inside `<details><summary>Détails techniques</summary> … </details>`.
- « État » in `CLAUDE.md`: replace the Phase 3 text with the state after Phase 4, at most 25 lines; the rest goes to `docs/TECH.md`.

## 11. Checks and tests

- `scripts/check_content.py`: also check `content/parcours.json` (bloc and chapter ids unique, each chapter's `bloc` exists, its `theme` exists when present, `title`, `when`, `resume`), `content/mots.json` (`text` 110 characters at most), `content/documents.json` (each document: `id` unique, `chapitre` in `parcours.json` or `"general"`, `title`, `kind` in the list above, `url` starting with `https://`, `added` a date; `folder` empty or an `https://` address) and `content/savais-tu.json` (`id` unique, `theme` exists, `text` 100 characters at most, `question` an existing question id when present).
- Tests: update them for the four tabs, the new Accueil states (with and without mots), Cours (the path, a filter, a chapter with and without documents, and a temporary list of 9 documents to see the search), the install sheet for iPhone Safari, an in-app browser and Android. Screenshots at 390 × 844, light and dark, of: Accueil at the four skies, Cours, Réviser, Planning (Semaine, Mois), a theme page, a lesson, the install sheet.
- Run everything before the pull request.

## Don't change

The content formats, how progress and Relecture are stored, the planning's logic and data, the welcome's steps (only its look at the top and its install step), the addresses of the pages (add `#cours`).

## At the end

Open one pull request with the description format above. Tell the owner what to test: installing from Safari, the four tabs and how they move, Accueil at the four skies (`#accueil?ciel=…`), the clock at the top of every screen (it must always be readable), dark mode, Cours, a lesson.
