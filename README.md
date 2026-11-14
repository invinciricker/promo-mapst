# Promo MAPST

The unofficial app of the BPJEPS MAPST class of 2026–2027 at CAPA Sports, in Nice.
Made by a trainee, for the class. It is not made or checked by CAPA Sports.

**Open it: https://invinciricker.github.io/promo-mapst/**

## What it does

| Tab | What you find there | Status |
|---|---|---|
| Accueil | The home: the Baie des Anges full screen and moving, one short line, and what's on now | Done (Phase 4) |
| Cours | The whole programme as a path of chapters, with short lessons (decks of cards) and a quiz, and « Questions de la promo » (ask, the admin answers); the course documents open later | Done (Phase 6) |
| Réviser | Five-minute quizzes on the course, with XP, a daily série and a weekly classement | Done (Phase 6) |
| Planning | The timetable by week, month and year, and the key dates | Done |
| Compte (in Profil) | Optional: a pseudo and a 6-digit code, so your progress follows you to a new phone | Done (Phase 6) |

## Put it on your phone

- **iPhone:** open the link in Safari, tap ⋯ or the Share button, then « Sur l'écran d'accueil », then « Ajouter ».
- **Android:** open the link in Chrome and tap « Installer ».

After that it opens like any other app, and it works without a connection.

## Good to know

- No tracking, no ads. Without an account, what you do in the app stays on your phone. With one (optional), your pseudo, your progress, your XP of the week if you join the classement, and your questions are kept in Europe on Google Firebase; Profil › « Supprimer mon compte » erases them.
- The lessons and questions are written from the course, but mistakes are possible: when in doubt, check your course.
- The repository is public, so it never contains course documents or anything personal.

## How it is made

Three roles: the **owner** decides, tests on his phone and publishes; **Claude chat** plans, designs and writes the content; **Claude Code** writes the code. Every change goes through a pull request that the owner merges, and GitHub Pages publishes it a minute later.

## Want the details?

- `docs/PLAN.md`: how the work is organised, in plain words, and every decision so far.
- `docs/TECH.md`: the technical guide (what each file does, how to add content, the tests).
- `docs/design/`: what the app should look like.
- `CLAUDE.md`: the instructions the AI follows.
