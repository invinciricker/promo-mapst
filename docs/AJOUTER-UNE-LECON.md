# Adding a lesson to Promo MAPST

For any Claude (chat or Code) asked to turn a course document, notes or a transcript into a lesson. Adding a lesson needs **no code and no design**: two small changes in `content/`, one pull request, and the owner merges.

## Before you write

- Work only from what the owner gives you (a document, notes, a transcript). If it's an audio file you can't listen to, ask for a transcript. Never add facts from elsewhere; if the source is unclear or contradicts itself, ask or leave it out.
- The repository is **public**: never copy a course document, a slide or a photo into it, never write a trainer's full name (initials only), nothing personal about anyone.
- Find the chapter in `content/parcours.json` (`chapitres`, by `id`). If none fits, propose a new chapter to the owner before adding it (see the end).

## The two changes

**1. The text: `content/lecons/<id>.md`.** The id is lowercase, with hyphens, starts with the chapter's subject, and never changes once published.

**2. One entry at the right place in `content/lecons/index.json`** (lessons of a chapter show in the file's order):

```json
{ "id": "filieres-les-trois", "chapitre": "filieres-energetiques", "title": "Les trois filières en cinq minutes",
  "minutes": 5, "source": "Les filières énergétiques (diaporama CAPA)", "status": "brouillon", "added": "2026-11-13" }
```

`status` is always `"brouillon"` for a new lesson: the owner checks it in the app (Mode relecture) and it becomes `"verifie"` later. `added` is today's date. `source` names the document in plain words, without a person's name.

## How a lesson is written

A lesson is a deck of **5 to 10 cards**, read on a phone in about five minutes. Each `## ` title starts a new card.

```markdown
## The card's title

One or two short paragraphs. **Bold** for the word to remember.

- a list when there are several things
- three or four items at most

> [!retenir] The one sentence to keep from this card.

? A question about what was just read
- [x] The right answer
- [ ] A wrong answer that someone could really believe
- [ ] Another one
= One sentence that says why.
```

The blocks you can use, and nothing else:

| Write | It shows |
|---|---|
| `> [!retenir] …` | « À retenir » |
| `> [!exemple] …` | « Exemple », a concrete case from the field |
| `> [!piege] …` | « Attention », a common mistake |
| `> [!savais-tu] …` | « Le savais-tu ? » |
| a small table (3 columns at most) | a comparison |
| `? …` + `- [x]` / `- [ ]` + `= …` | a question inside the card: 2 to 4 choices, exactly one right |
| `![description](img/name.svg)` | a diagram you drew yourself as an SVG, saved in `content/lecons/img/` |

## What makes a good lesson

- **One idea per card**, 60 words at most (90 is the hard limit). If a card needs more, cut it in two.
- French, « tu », short sentences, the words used in class. Plain spaces before `? ! :` (the app fixes the typography).
- Start with why it matters to an educator, end with what to do with it on the field.
- Two or three questions per lesson, each right after the card that teaches the answer.
- The numbers are those of the source, exactly.
- No lesson without something concrete: a sport, a situation, a public.

## Optional, in the same pull request

- **Quiz questions** for Réviser: `content/questions.json`, format in `CLAUDE.md`, 8 to 10 per lesson of a theme, status `"brouillon"`. A chapter gets a quiz when it has a `theme` in `parcours.json` that exists in `content/themes.json`.
- **A fact for Accueil**: one line in `content/savais-tu.json` (100 characters at most).
- **A new chapter**: an entry in `chapitres` of `content/parcours.json`, at its place in the year: `id`, `title`, `bloc` (`bc1`, `bc2`, `bc3` or `transversal`), `when`, `resume` (one line), and `theme` if it has a quiz.
- One line in `docs/CONTENT.md` (which source became which lesson).

## Before you open the pull request

1. Run `python3 scripts/check_content.py`: it must end with « OK ». Fix what it reports.
2. Push a branch named `chat/lecon-<id>` and open a pull request that touches only `content/` and `docs/`. Its description starts with « En bref » (two or three plain sentences: which lesson, from which source) and « À tester sur ton téléphone » (open Cours, the chapter, the lesson, with Mode relecture on).
3. Never push to `main`; the owner merges. The app updates by itself a minute or two later.
