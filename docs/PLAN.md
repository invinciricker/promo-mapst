# How Promo MAPST is built

Kept up to date by Claude chat. Last update: 7 Nov 2026.

## Who does what

| Who | Writes | Never touches |
|---|---|---|
| **Claude chat**, in the owner's claude.ai Project « BPJEPS MAPST » (it holds the course files) | `content/` (questions, study pages, diagrams, themes, planning data), `docs/`, the phase specs in `CLAUDE.md`, the prompts for Claude Code | Code |
| **Claude Code**, at claude.ai/code | All code: `index.html`, `css/`, `js/`, `sw.js`, the manifest, `scripts/`, `tests/`, `.github/`, `vendor/`, `README.md`, and « État » at the bottom of `CLAUDE.md` | `content/`, `docs/` |
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
1. Claude chat prepares a branch `chat/phase-N`: content, the updated spec in `CLAUDE.md`, these docs.
2. The owner starts a fresh Claude Code session on `promo-mapst` and pastes the short prompt Claude chat gives them.
3. Claude Code merges `chat/phase-N` into its own branch, builds, tests, updates « État » and opens one pull request.
4. The owner tests on their phone and merges. GitHub Pages publishes within a minute or two.

### New questions or study pages (no code)
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
- Claude Code never reads course files, and its prompts stay short: the brief is `CLAUDE.md`.
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
