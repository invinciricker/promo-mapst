# Content log

Kept by Claude chat. Read this before writing new content, so that no course file is read twice.
Last update: 12 Nov 2026.

## Course files

They stay in the owner's claude.ai Project « BPJEPS MAPST », never in this repository.

| Course file (CAPA) | Theme | What it covers | Used so far | Watch out |
|---|---|---|---|---|
| Anatomie du mouvement (slide text, 6 chapters) | anatomie-mouvement | 1 intro, 2 bones, 3 joints, 4 muscles, 5 biomechanics, 6 movement analysis and injuries | ch. 2–3 (lesson 1), ch. 3–4 (lesson 2) | The muscle slides lost their pictures |
| Récapitulatif des principaux mouvements (1 p.) | anatomie-mouvement | Neck, hip and shoulder: movements and their muscles | Shoulder, hip (lesson 2) | |
| Les muscles (1 p.) | anatomie-mouvement | Wrist muscles: origin, insertion, movements | Not yet | |
| Les filières énergétiques (55 slides) | filieres-energetiques | 1 ATP and substrates, 2 ATP-PCr, 3 lactic, 4 aerobic, 5 together + case studies, training each system | Basics of ch. 1–5 (lesson 1) | |
| Les différents publics et leurs caractéristiques (37 slides) | publics | Notion of public, needs, Maslow, needs to spot, publics by age, motivation, adapting, mistakes to avoid | ch. 1–4, 6, 7.1 (lesson 1) | |
| Les activités d'entretien corporel (27 p.) | entretien-corporel | Definitions, health, publics, 19 activities | Definitions, publics, haltérophilie, marche nordique, Pilates, Zumba (lesson 1) | The Step page repeats the Renfo-baguettes text; the HIIT figures (rest/effort ratio, « 9 fois plus ») are doubtful: not used |
| Les rôles de l'éducateur sportif, fiche descriptive (2 p.) | role-educateur | Blocks a) to e) | Block e), the P.O.S.S. (lesson 1) | |
| Obligations des éducateurs et établissements sportifs (5 p.) | role-educateur | Qualification, honorabilité, déclaration, carte pro, sanctions; EAPS rules; documents to collect | Most of it (lesson 1) | Mixes the old DDCSPP name with SDJES; the DTP line for under-6s is doubtful: not used |
| Cours fiche de séance du 15 sept., two transcripts | fiche-de-seance | Durations, phases, objectives, warm-up, criteria, variants, evaluation, equipment, stretching | Main rules (lesson 1) | Speech-to-text, messy: rules cross-checked between the two parts |
| Fiches de Révision BPJEPS MAPST (70 p., scanned) | several | Physiology, anatomy, regulation, publics, programming | Not yet | Scanned: save its text to the Project the first time it's read. Some regulation lines are out of date |
| Arrêté du 9 nov. 2024 (MAPST and its BC1–BC3 référentiel) | role-educateur, later | The diploma itself | Not yet | Public text (Journal officiel) |

## Questions

| Theme | Lesson | Title | Questions | Status | Sources |
|---|---|---|---|---|---|
| anatomie-mouvement | 1 | Os et articulations | 10 | brouillon | Anatomie du mouvement, ch. 2–3 |
| anatomie-mouvement | 2 | Muscles et contractions | 10 | brouillon | Anatomie du mouvement, ch. 3–4; Récapitulatif |
| filieres-energetiques | 1 | L'ATP et les trois filières | 10 | brouillon | Les filières énergétiques |
| publics | 1 | Besoins, Maslow et motivation | 10 | brouillon | Les différents publics |
| entretien-corporel | 1 | Santé, définitions et activités | 10 | brouillon | Les activités d'entretien corporel |
| role-educateur | 1 | Obligations et sanctions | 10 | brouillon | Obligations; Les rôles de l'éducateur sportif |
| fiche-de-seance | 1 | Construire sa fiche | 10 | brouillon | Cours fiche de séance du 15 sept. |

Total: 70 (47 QCM, 12 of them with several right answers; 16 à taper; 7 à associer).
Ids: `anat-`, `fil-`, `pub-`, `ent-`, `role-`, `fds-`, then lesson and number (`anat-1-04`). Never reuse or change an id.

## How questions are written

- QCM: 4 choices with plausible wrong answers, often taken from the same course, so they can't be done half-asleep. Some have several right answers.
- Réponse à taper: the hint is a clue or a mnemonic that never contains the answer; spelling variants go in `answers`.
- One-sentence explanation; the source gives the course file and the slide or page.
- Only facts from the course files. Where a course file looks wrong or out of date, leave it out and note it above.

## Next

- Lesson 2: filières (training each system: intensities, durations, recoveries; case studies), publics (publics by age, disability, adaptation variables, mistakes), entretien corporel (more activities), rôle (blocks a) to d), EAPS secours and insurance, documents), fiche de séance (evaluation, equipment, stretching, cycle).
- Anatomy lesson 3: biomechanics (centre of gravity, base of support, levers, power) and injuries. Anatomy lesson 4: wrist muscles (Les muscles).
- Phase 5 (Étudier), study pages and SVG diagrams: planes and axes of movement; the three energy systems over time; the parts of a séance; Maslow's pyramid; the anatomy of a long bone; agonist and antagonist.

## Relecture log

- **6 Nov 2026** · 70 questions written, all `brouillon`. No report yet.
- **7 Nov 2026** · The owner chose to publish the 70 questions as they are (still `brouillon`, shown to everyone from Phase 3) and to check them later. anat-1-02 became a QCM: as a typed answer, « ostéoclastes » was one typo away from « ostéoblastes » and would have been accepted.

## Planning corrections

The app follows « Planning MAPST » (CAPA, 1 Oct 2026). The one-page « Calendrier BPJEPS MAPST » (Dec 2025) is older: only its dossier dates and school holidays are used, marked « à confirmer ».
Corrections for the whole class go in `content/planning-fixes.json`; personal details (the owner's structure, partner, hours) never do.

| Added | Dates | Correction | Source |
|---|---|---|---|
| 7 Nov 2026 | 2–20 Nov 2026 | « MSP 1 au centre de loisirs » → « Stage APEC · AnimaNice » (Wednesdays stay at the centre de loisirs) | CAPA's email to the class, 30 Oct 2026; Ville de Nice, 3 Nov 2026 |

## Documents of the Cours tab (`content/documents.json`)

Empty on 12 Nov 2026: waiting for the owner's Drive folder (see « Decisions waiting for the owner » in `docs/PLAN.md`). When the link arrives, Claude chat lists the folder and writes one entry per document: theme, a clear French title (not the file name), kind, link, date added. Personal papers (attestation, contract, fiche de renseignement) never go in.

## « Le savais-tu ? » (`content/savais-tu.json`)

23 short facts for Accueil, written on 12 Nov 2026. Each one restates the explanation of an existing question (its id is in `question`), so it has the same source and goes through the same Relecture: if a question is corrected, correct its fact too.
