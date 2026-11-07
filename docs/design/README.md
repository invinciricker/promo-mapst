# Design: the « nouveau look » (Phase 3)

Written by Claude chat on 7 Nov 2026, after the owner found the app crowded and too dark.
This folder is the target for Phase 3. `CLAUDE.md` (« Nouveau look ») says what to build; this file says how it should look.

## What's here

| File | What it is |
|---|---|
| `mockups.html` | 11 phone screens at iPhone size (390 × 844), a colour and type panel, and the Accueil window at the four moments of the day. Real planning data and real questions. |
| `mockups.jpg` | A picture of all of it, to look at on GitHub from a phone. Redo it when `mockups.html` changes. |
| `baie-aube.svg`, `baie-jour.svg`, `baie-couchant.svg`, `baie-nuit.svg` | « La Baie », the app's illustration: the Baie des Anges from the Promenade, at dawn, by day, at sunset and at night. Drawn for the app, so free to use. |
| `baie.py` | The script that draws them. `python3 docs/design/baie.py docs/design` redraws all four the same way every time. |

To see the mockups, run `python3 -m http.server 8000` at the root of the repository, then open `http://localhost:8000/docs/design/mockups.html`. Opened straight from the disk, the font and the pictures don't load.

## The screens

1. **Bienvenue**: first launch only. The dawn scene, the name, one sentence, « Commencer ».
2. **Ton prénom**: step 1 of 2 (step 2, the install help, only shows in a browser). In Phase 4 this step becomes the account.
3. **Accueil** on a Saturday morning: the window onto the bay, « Aujourd'hui » (no class, so the next half-day), « Réviser ».
4. **Accueil** on a weekday evening, phone in dark mode: night sky, « Fini pour aujourd'hui », tomorrow, the série reminder.
5. **Réviser**: « Continuer » and « Mes erreurs » in one card, then the theme tiles.
6. **Un thème**: a page pushed from Réviser, with « ‹ Réviser ». Current lesson (ring and play), locked lesson.
7. **Une question** after a wrong answer: the right choice in turquoise, the wrong one in bougainvillier, the explanation rising from the bottom.
8. **Profil**: opened from the round initial on Accueil. Replaces the Infos screen.
9. **Planning, Semaine**: the 7-day strip, a dated note, the chosen day's half-days, then « Dates clés » and « Ajouter à ton agenda ».
10. **Détails d'une demi-journée**: a sheet over the planning, with « Réviser ce thème » when a theme matches.
11. **Dates clés**: a page pushed from Planning; J-x on épreuves and dossiers.
12. **Couleurs et texte**: the palette and the type scale.
13. **The Accueil window** at aube, jour, couchant and nuit.

States not drawn, to build in the same style: a lesson done (filled circle in the theme colour with a white check), a right answer (the feedback in turquoise, title « Bonne réponse ! »), the end-of-lesson celebration, Mois and Année (current logic, new tokens), the Relecture buttons and report.

## Rules of the look

- **One job per screen.** Accueil shows today and what to revise, nothing else. Everything else is one tap away on its own page.
- **Bright.** Light background `#F3F7FA`, white cards, CAPA navy `#103550` for text. Navy is never a big background in light mode.
- **Colour has a meaning.** One colour per mode (Accueil soleil, Réviser turquoise, Planning azur, Étudier lavande from Phase 5) for the active tab and the back buttons. The planning keeps its Nice categories. Each Réviser theme has its own colour.
- **Small and light type.** Body 15 px, weights 500 to 700, 800 only for page titles and the greeting. No capital-letter labels, no grey text under 13 px.
- **Few lines and boxes.** Cards group things; inside a card, thin lines separate rows. No borders around cards, one soft shadow.
- **French copy, short, « tu ».** Buttons say what they do (« Continuer », « Réviser ce thème »). No-break space before `? ! : ;` and inside « ».

## Tokens

The CSS variables at the top of `mockups.html` are the tokens; copy them into `css/01-tokens.css`. The `.dark` block becomes `@media (prefers-color-scheme: dark) { :root { … } }`.

Each colour comes in three:
- `--X` fills: bars, dots, progress, rings.
- `--X-ink` text and icons in that colour, and the background of filled buttons in that colour (with `--on-accent` text).
- `--X-tint` soft backgrounds: chips, icon tiles, the active tab.

Every `--X-ink` reads at 4.5:1 or more on its tint and on white, and the dark values do the same on the dark surfaces. The main button is always turquoise `#00E6BF` with navy text, in both modes.

Réviser theme colours, in the order of `content/themes.json`: bougainvillier, soleil, lavande, turquoise, azur, olivier. A seventh theme starts the list again.

## The window onto the bay (Accueil)

- It keeps the shape 358 × 220 (`aspect-ratio`) at every width, with `object-fit: cover` and `object-position: 50% 54%`. That crop shows the sky (for the greeting), the hills, the horizon and a strip of sea, and keeps the palm out of view. On a laptop it simply grows with the column.
- Which picture: the sky of Nice that day, from the real sunrise and sunset (43.70° N, 7.27° E):
  - aube: from 1 h before sunrise to 2 h after;
  - jour: the rest of the day;
  - couchant: from 1 h 30 before sunset to 45 min after;
  - nuit: from then until 1 h before sunrise.
- Text on the window is navy, white at night. « Bonjour » until 18:00, then « Bonsoir ».
- The SVGs use different ids inside (`aube-sky`, `nuit-sky`…), so two of them can sit on the same page. Keep it that way if one is redrawn.

The Bienvenue screen uses `baie-aube.svg` full screen, anchored at the bottom (`object-position: 50% 100%`), with a soft fade from the page background at the top so the status bar blends in.

## Getting around (and the iPhone back button)

An app installed from Safari has no back button of its own, so the app provides one.

```
Tab bar          Accueil        Réviser            Planning
                    │              │                  │
Pages            Profil        Un thème          Dates clés
(slide in from      │              │
 the right,      Rapport de    Une leçon (full screen, × to leave)
 « ‹ » top left)  relecture

Sheets           details of a half-day, « Couleurs », confirmations (slide up from the bottom)
```

- A page opened from another one slides in from the right, with « ‹ Name of the previous screen » at the top left. A swipe from the left edge goes back too.
- A sheet closes with its ×, a swipe down, a tap outside, or back.
- Every page and sheet has its own address, so Android's back button and gesture work as expected.
- Tapping the current tab again goes back to its first screen.

## Status bar

The app is light now, so on iPhone it uses `apple-mobile-web-app-status-bar-style` `default`: a dark clock on a light bar, and the app starts below it (the mockups show it that way). `black-translucent`, used until Phase 2, would put a white clock over the light pages, where it can't be read.
