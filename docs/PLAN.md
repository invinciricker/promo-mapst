# How Promo MAPST is built

Kept up to date by Claude chat. Last update: 12 Nov 2026.

## In plain words (start here)

The app is a folder of files stored on GitHub. GitHub also serves that folder as a website, and that website is the app your classmates open.

- **You** say what you want, test on your phone, and press the button that publishes.
- **Claude chat** (the conversation in your « BPJEPS MAPST » Project) is the architect: it decides how things should look and work, draws a working model, and writes the questions and texts from your course files. It then writes a brief: a to-do list precise enough that nobody has to guess.
- **Claude Code** is the builder: it reads the brief and writes the code. You start it by pasting a short message that Claude chat gives you.

What happens to a change, every time:
1. Claude chat puts its work on a **branch**: a separate copy of the folder, so nothing breaks while it's being worked on.
2. A **pull request** is the proposal « put this branch into the real app ». GitHub runs automatic checks on it: a green tick means the content files are sound.
3. You **merge** it: the proposal is accepted, and a minute or two later the app on everyone's phone updates by itself.

Where to look when you want to know what's going on:
- this file, « Decisions » at the bottom: what was decided and when;
- `docs/phases/`: the brief of each phase, the current one first;
- `docs/design/prototype.html`: the working model of the look;
- each pull request starts with « En bref »: a few plain sentences on what it changes.

## Who does what

| Who | Writes | Never touches |
|---|---|---|
| **Claude chat**, in the owner's claude.ai Project « BPJEPS MAPST » (it holds the course files) | The decisions and the design: `docs/design/` (prototype, mockups, illustration), the brief of each phase in `docs/phases/`, `content/` (questions, documents list, facts, planning data), the rest of `docs/`, `CLAUDE.md`, the prompts for Claude Code | App code |
| **Claude Code**, at claude.ai/code | All code: `index.html`, `css/`, `js/`, `sw.js`, the manifest, `scripts/`, `tests/`, `.github/`, `vendor/`, `img/`, the table in `README.md`, `docs/TECH.md`, and « État » at the bottom of `CLAUDE.md` | `content/`, the rest of `docs/` |
| **The owner** (the trainee who runs this repository) | Decisions, testing on their phone, Relecture of the questions, merging | — |

Claude Code never needs the course files: everything it needs is in this repository.

## The rules

1. Nothing reaches `main` except through a pull request that the owner merges. Nobody pushes to `main`.
2. Every file belongs to one side (table above), so two pull requests can never fight over the same file. If Claude Code finds a problem in `content/`, it lists it in its pull request instead of editing.
3. The content formats are in `CLAUDE.md`. A format changes only with the owner's OK, and Claude chat updates `CLAUDE.md` when it does.
4. One fresh Claude Code session per phase or per job.
5. The repository is public: no personal data, no course PDFs, slides or photos, no images copied from course documents.

## How the work flows

### A phase (new features)
1. Claude chat prepares a branch `chat/phase-N`: a working prototype in `docs/design/`, the brief in `docs/phases/phase-N.md`, the content, these docs. All the decisions are taken there, so that Claude Code only has to build (and can run on a cheaper model).
2. The owner starts a fresh Claude Code session on `promo-mapst` and pastes the short prompt Claude chat gives them.
3. Claude Code merges `chat/phase-N` into its own branch, builds, tests, updates « État » and opens one pull request.
4. The owner tests on their phone and merges. GitHub Pages publishes within a minute or two.

### New lessons or questions (no code)
The exact steps are in `docs/AJOUTER-UNE-LECON.md`; any Claude conversation with access to this repository can follow them.

1. The owner adds the course file, or a photo of their notes, to the claude.ai Project and tells Claude chat what it is.
2. Claude chat writes the content, updates `docs/CONTENT.md`, pushes a branch `chat/contenu-…` and opens a pull request that only touches `content/` and `docs/`.
3. The automatic checks run (from Phase 2). The owner merges. No Claude Code session needed.

### Checking the questions (Relecture)
1. New questions arrive with status `brouillon`. Since 7 Nov 2026 classmates see them too (the owner's choice, from Phase 3), so Relecture is for catching mistakes, not for unlocking questions.
2. The owner switches on « Mode relecture » in Profil (Infos before Phase 3), plays the lessons and taps « Juste » or « À corriger » (with a note) on each question.
3. They tap « Copier le rapport » and paste it into a chat with Claude chat.
4. Claude chat fixes the flagged questions and switches the others to `verifie` in a content pull request.

### Code tweaks
Small ones: the owner asks Claude Code directly. Bigger ones: the owner asks Claude chat, which writes the prompt.

### A new planning PDF
The owner adds it to the claude.ai Project. Claude chat updates the private timetable repository and regenerates `content/planning.json` and `content/planning.ics` with the existing scripts, then opens a content pull request. If a script needs changing, that part is a Claude Code job.

When the official planning is wrong for the whole class (an email from CAPA, a change announced in class), Claude chat adds a correction to `content/planning-fixes.json` and applies it to `planning.json` and `planning.ics`. From Phase 3, `scripts/export_planning.py` applies those corrections on every run, so a new export never undoes them.

## Saving usage

Claude chat and Claude Code use the same Pro allowance.
- Claude Code never reads course files, and its prompts stay short: the brief is `docs/phases/phase-N.md`, and `CLAUDE.md` stays small (it is read at every step).
- The thinking happens once, in Claude chat. Claude Code gets a prototype to copy and a brief with no open questions, so a session can run on Sonnet instead of the most expensive model.
- Content updates skip Claude Code.
- `docs/CONTENT.md` records which course files have been used and for what, so nothing is read twice.
- The first time Claude chat reads a scanned file (photos of pages), it saves the text as a doc in the claude.ai Project.

## Decisions

- **6 Nov 2026** · Three modes (Réviser, Étudier, Planning); a web app installed from a link, hosted on GitHub Pages from this public repository.
- **6 Nov 2026** · Design: polished, App Store style, Plus Jakarta Sans, CAPA colours (navy, turquoise, orange, blue). The "Riviera" design of the owner's personal timetable page was dropped.
- **6 Nov 2026** · Planning: whole-class information only; trainers as initials; Lavande = « Préparation ».
- **6 Nov 2026** · Accounts (Phase 4): username + 6-digit PIN through Firebase, no email or real name; a class code to join the classement.
- **6 Nov 2026** · Who does what: as above. Claude chat's draft of the Réviser engine is handed to Claude Code on `chat/phase-2`; from then on Claude Code owns all code.
- **6 Nov 2026** · Questions start as `brouillon` and go live after the owner's Relecture. Lesson titles live in `themes.json`.
- **7 Nov 2026** · The owner found the app crowded and too dark. Phase 3 becomes « Nouveau look »: bright, an Accueil tab with a window onto the Baie des Anges that follows the sky of the day, pages with back buttons, smaller type, a welcome with the first name. Target: `docs/design/`.
- **7 Nov 2026** · Phase order: 3 Nouveau look, 4 Accounts (the owner wants the sign-in soon), 5 Étudier. Étudier's tab stays hidden until it has pages.
- **7 Nov 2026** · The 70 `brouillon` questions go live for everyone as they are; the owner will check them later in Relecture.
- **7 Nov 2026** · Planning: from 2 to 20 Nov the class is on the stage APEC in the AnimaNice (CAPA's email of 30 Oct), not « MSP 1 au centre de loisirs » as the official planning says. Kept in `content/planning-fixes.json`.
- **7 Nov 2026** · « Infos » becomes « Profil », opened from Accueil.
- **12 Nov 2026** · After testing Phase 3 on his iPhone, the owner finds it still feels like a website. Phase 4 becomes « Une vraie appli »: four tabs (Accueil, Cours, Réviser, Planning) in a floating glass bar; a full-screen home with the bay, one glass card and two shortcuts; a coloured header per tab; movement between tabs; a guided install. Target: `docs/design/prototype.html`, brief: `docs/phases/phase-4.md`.
- **12 Nov 2026** · « Étudier » becomes **Cours**: first the course documents, linked from a Google Drive folder shared with the class; the study pages (« fiches ») join it in Phase 6.
- **12 Nov 2026** · XP and série leave Accueil for Réviser. Accueil shows a course fact that changes (« Le savais-tu ? »).
- **12 Nov 2026** · The iPhone status bar goes back to `black-translucent` (the app draws under the clock), so the top of every screen is coloured.
- **12 Nov 2026** · Phase order: 4 Une vraie appli, 5 Comptes, classement et questions de la promo, 6 Les fiches.
- **12 Nov 2026** · Words for humans: `README.md` is short; the technical guide moves to `docs/TECH.md`; pull requests start with « En bref »; `CLAUDE.md` is cut to the essentials and the old briefs move to `docs/phases/`.
- **12 Nov 2026 (evening)** · After trying the prototype: Accueil keeps only the moving picture, one short line (« le mot »: the owner's quotes, or course facts) and « En ce moment »; no shortcuts. The sea, the boat and the clouds move at three speeds, in a loop.
- **12 Nov 2026 (evening)** · Cours is not a shelf of documents: it is the programme as a path of chapters in the order of the year, tagged by bloc de compétences. Documents are a button inside a chapter. The fun lessons come in Phase 6.
- **12 Nov 2026 (evening)** · Planning, Semaine: bigger day cards (day, date, what's on, morning and afternoon), then « Aujourd'hui », then Dates clés.
- **12 Nov 2026 (evening)** · Questions from classmates stay in Phase 5 (they need accounts to know who asks). Free version: the owner answers. Entry points: a button at the top of Cours and in each chapter, not on Accueil.
- **13 Nov 2026** · Design is frozen for now; content comes first. Phase 5 becomes « Les leçons » (short lessons as decks of cards inside Cours); accounts and questions move to Phase 6. Small fixes wait for a clean-up at the end.
- **13 Nov 2026** · Cours shows the whole programme: 19 chapters and the four blocs, even where nothing is written yet. The course documents stay closed (« Bientôt ») until the school gives permission.
- **13 Nov 2026** · Adding a lesson must never need a code session: `docs/AJOUTER-UNE-LECON.md` is the guide any Claude follows (the text, one entry in the index, a pull request).

## Decisions waiting for the owner

- **The class's Drive folder.** The Cours tab needs one Google Drive folder with the course documents. Share it with your classmates' Google addresses (« Restricted », not « Anyone with the link »): the links will sit in this public repository, and with restricted sharing they open only for the class. Then give the folder's link to Claude chat, which writes `content/documents.json`.
- **Answers by Claude inside the app.** Asking a question and getting an answer from Claude, based on the course files, needs two things the app doesn't have: an Anthropic API key (paid per question, a few cents a day for a class, separate from the Claude subscription) and a small server to keep that key secret (the app's code is public). Phase 5 therefore starts without it: questions are saved with the name of who asked, you answer them (with Claude chat's help if you like), and everyone sees the answers. The automatic first answer can be added later if you decide to pay for it.
