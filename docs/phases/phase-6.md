# Phase 6: comptes, classement et questions de la promo

Written by Claude chat, 13 Nov 2026. For Claude Code: build exactly this. **Nothing to redesign**: every screen below is made of parts the app already has (pages with `.topbar--page`, sheets, cards, `.input--big`, the turquoise main button, glass buttons, toasts). When this brief is silent, take the simplest option that looks like the rest of the app and list it under « Choix faits ».

Phase 5 (« Les leçons ») must be merged first.

## In one paragraph

Until now everything lives on the phone. This phase adds an optional account (a pseudo and a 6-digit code, no e-mail), which saves the progress online so it follows the person to a new phone, a weekly classement for those who want to appear, and « Questions de la promo », where classmates ask questions about the course and the owner answers. The service is Firebase, free plan. The app keeps working fully without an account and offline.

## What the owner has already done

The steps of `docs/firebase/README.md` (project, sign-in by e-mail/password, Firestore in Europe, the rules published, the class code). He pastes the `firebaseConfig` block in the prompt. If it is missing, build everything with the fake backend (below), leave `js/compte/config.js` with empty values, make the app hide every account feature while the config is empty, and say so at the top of the pull request.

## Firebase, technically

- **SDK**: the modular Firebase JS SDK, three browser files copied from the npm package `firebase` (pin the version, note it in docs/TECH.md) into `vendor/firebase/`: `firebase-app.js`, `firebase-auth.js`, `firebase-firestore-lite.js`. **Firestore Lite** on purpose: plain reads and writes, no live listeners, much smaller. No Analytics, no other product. Nothing from a CDN.
- **Loaded late**: the three files are imported with `import()` only when needed (a signed-in launch after the first screen is shown, or the first tap on an account feature). The app must start as fast as today. Add them to the list in sw.js.
- **`js/compte/config.js`**: the `firebaseConfig` object and `export const DOMAINE = "promo-mapst.example.com"`.
- **`js/compte/backend.js`**: the only file that talks to Firebase. Everything else calls its functions (`creerCompte`, `connecter`, `deconnecter`, `changerCode`, `supprimerCompte`, `lireProfil`, `ecrireProgres`, `lireClassement`, `ecrireScore`, `retirerScore`, `listerQuestions`, `poserQuestion`, `basculerAussi`, `repondre`, `supprimerQuestion`, `estAdmin`). **`js/compte/backend-faux.js`** has the same functions kept in memory, used when the address has `?backend=faux` on localhost only: the tests run on it.
- **The rules** are `docs/firebase/firestore.rules`, written by Claude chat and already published. Do not edit that file. The data shapes below match it exactly; if something cannot work with the rules, say it under « Choix faits » instead of changing them. If the Firebase emulator can run in your sandbox, test the rules with it (a `tests/test_rules.*`); if it cannot, say so in the pull request.

### Identity

- A **pseudo**: 3 to 15 characters among `a-z A-Z 0-9 - _`. `cle` = the pseudo in lowercase. The hidden address is `<cle>@promo-mapst.example.com` (example.com can never receive mail, so no reset e-mail can leak). Never show the address.
- A **code**: exactly 6 digits, used as the Firebase password. Refuse the obvious ones before sending: six times the same digit, a straight run up or down (123456, 654321, 012345, 987654…), a pattern of 2 or 3 digits repeated (121212, 123123), a mirror (123321), and 112233, 111222. Message: « Trop facile à deviner. Choisis-en un autre. »
- Auth keeps people signed in (its default, saved on the phone). The code is asked again only on a new phone or after « Me déconnecter ».
- Who I am, on the phone: `promo-mapst:compte` = `{ pseudo, cle, classement: true|false, sync: <ms of the last successful sync> }`.

### Data (Firestore)

| Document | Fields |
|---|---|
| `membres/<cle>` | `pseudo` (as typed), `code` (the class code typed at creation), `creeLe` (server time), `progres` (one JSON text, see Sync), `majLe` (server time) |
| `classement/<cle>` | `pseudo`, `xp` (whole number: XP of the week), `semaine` (« 2026-W46 », ISO week, Monday first, Europe/Paris), `majLe` (server time) |
| `questions/<auto id>` | `texte` (3 to 500 characters), `auteur` (= cle), `pseudo`, `chapitre` (a chapter id or ""), `creeLe` (server time), `reponse` ("" at first), `aussi` (list of cle, empty at first); the admin's answer adds `reponduLe` (server time) |
| `admins/<cle>`, `codes/<code>` | created by hand by the owner; the app only does `get` on `admins/<my cle>` |

Use `serverTimestamp()` for every date: the rules require it.

### Creating an account, in order

1. `createUserWithEmailAndPassword(address, code)`. Error `auth/email-already-in-use` → see « The pseudo exists » below.
2. `getDoc(membres/<cle>)`. **If it exists** (a forgotten code being repaired, see README): do not write, go to step 4.
3. `setDoc(membres/<cle>, { pseudo, code: <class code>, creeLe, progres: <local progress as JSON>, majLe })`. If it is refused (`permission-denied`: wrong class code): **delete the Auth user just created** (`deleteUser`), and show « Ce code de la promo n'est pas bon. Demande-le à ton groupe. »
4. Save `promo-mapst:compte`, run a sync, write the classement line if the person chose to appear.

The pseudo exists (`auth/email-already-in-use`): « Ce pseudo est déjà pris. Si c'est le tien, connecte-toi. »

Signing in: `signInWithEmailAndPassword`. Any credential error (`auth/invalid-credential`, `auth/wrong-password`, `auth/user-not-found`) → « Pseudo ou code incorrect. » `auth/too-many-requests` → « Trop d'essais. Réessaie dans quelques minutes. » Then `getDoc(membres/<cle>)`: if it does not exist (an account made without the class code), show the « Code de la promo » field alone and do step 3.

No network during any account action: « Pas de connexion. Réessaie quand tu as du réseau. » Nothing else changes.

### Sync of the progress

What is synced: the saved value of `promo-mapst:reviser` and of the lessons read (Phase 5's key). **Not synced**: the first name, the welcome flag, Relecture, the personal events of the Planning, settings.

`progres` = `JSON.stringify({ v: 1, reviser: <object>, lecons: <object> })`.

- **When**: at launch if signed in and online (one read of `membres/<cle>`, then a merge, then a write only if the merge changed something); after each finished lesson, quiz or review (wait 5 s, group several changes in one write); when the app goes to the background (`visibilitychange` → hidden) if something is unsent. Never more than one write every 15 s. Failures are silent and retried at the next occasion.
- **Merge** (phone + online → both), item by item, so nothing is ever lost:
  - `reviser.xp`: the larger. `reviser.days`: for each day, the entry with the larger `xp`. `reviser.done`: for each question id, the larger value.
  - `reviser.cards`, `reviser.runs`, `reviser.lastTheme`: from the side saved last (compare the phone's last local change with `majLe`).
  - lessons read: for each lesson, the further progress; « terminée » wins.
- Put the merge in one pure function with unit tests (`tests/test_sync.*`).
- After a merge that changed the phone's data, refresh the screens the same way they refresh today after a lesson.

### Classement

- XP of the week = the sum of `reviser.days[day].xp` for the days of the current ISO week (Europe/Paris).
- Written after each sync when `classement` is true. Respect the rules: never send less than the last value sent for the same week (skip the write); never more than +400 per write, nor more than 400 on the first write of a new week (3 000 on the very first line): if the real number is higher, send the allowed maximum and the rest at the next sync. At least 10 s between two writes.
- Reading: `getDocs(classement)` with `limit(100)`, keep the lines of the current week, sort by `xp` then by pseudo. Read when the page opens and on pull-to-refresh or a « Actualiser » glass button; keep the last result on the phone for offline (« Mis à jour hier à 18:02 »).
- Turning « Apparaître dans le classement » off deletes `classement/<cle>`.

## Screens

French, « tu », short. The texts below are final.

### Welcome

Step « Ton prénom » stays as it is (the first name stays on the phone). Add after it a step **« Ton compte »**: title « Garde ta progression », line « Avec un compte, tu retrouves tes XP sur un nouveau téléphone et tu peux poser tes questions à la promo. », main button « Créer mon compte », glass button « J'ai déjà un compte », text link « Plus tard ». Then the install step as today.

### Compte (a sheet, opened from the welcome, Profil, the classement and the questions)

**Créer mon compte**
- « Pseudo » (hint under it: « Pas ton nom complet. 3 à 15 lettres ou chiffres. »)
- « Code à 6 chiffres » (`inputmode="numeric"`, hidden like a password, an eye to show it) and « Encore une fois »
- under them: « N'utilise pas le code de ta carte bancaire ni celui de ton téléphone. »
- « Code de la promo » (hint: « Celui donné dans le groupe de la promo. »)
- a switch « Apparaître dans le classement » (off at first), hint « Les autres voient ton pseudo et tes XP de la semaine. »
- a folded line « Ce qui est enregistré » that opens: « Ton pseudo, ton code (illisible, même pour nous), ta progression, tes XP de la semaine si tu choisis le classement, et tes questions. Pas d'e-mail, pas de nom. C'est stocké en Europe, chez Google Firebase. Tu peux tout supprimer dans Profil. »
- main button « Créer mon compte »; link « J'ai déjà un compte ».
- Errors under the field concerned: « 3 à 15 lettres, chiffres, - ou _ », « Il faut 6 chiffres. », « Les deux codes sont différents. », and those above.
- Success: the sheet closes, toast « Compte créé. Ta progression est sauvegardée. »

**Me connecter**: « Pseudo », « Code à 6 chiffres », main button « Me connecter », link « Créer un compte », and a small line « Code oublié ? Demande à l'admin de la promo : il peut t'en redonner un. » Success: toast « Content de te revoir, <pseudo>. »

### Profil

A card **« Mon compte »** above the existing rows.
- Not signed in: line « Sauvegarde ta progression et rejoins le classement. », buttons « Créer mon compte » and « J'ai déjà un compte ».
- Signed in: the pseudo; « Sauvegardé il y a 2 min » (or « Pas encore sauvegardé »); the switch « Apparaître dans le classement »; rows « Changer mon code » (asks the current code, then the new one twice; `reauthenticateWithCredential` then `updatePassword`; toast « Code changé. »), « Me déconnecter » (confirmation sheet: « Ta progression reste sur ce téléphone. »), and, in bougainvillier, « Supprimer mon compte ».
- **Supprimer mon compte**: confirmation sheet « Supprimer ton compte ? », text « Ton pseudo, ta progression en ligne, ta place au classement et tes questions seront effacés. Ta progression reste sur ce téléphone. », the person types their code, button « Supprimer définitivement ». Order: reauthenticate, delete their questions (`where("auteur", "==", cle)`), `classement/<cle>`, `membres/<cle>`, then `deleteUser`, then remove `promo-mapst:compte`. Toast « Compte supprimé. »

### Classement (page `#reviser/classement`, back to Réviser)

- Opened by tapping the XP chip in Réviser's header, and by a row « Classement de la semaine » in Profil.
- Header of a page with the title « Classement », under it « Cette semaine · remis à zéro lundi ».
- A card with one row per person: rank, the round initial (same as Profil's), pseudo, XP on the right. The first three ranks in soleil, galet and bougainvillier tints. My own row has the turquoise tint and « toi » after the pseudo. Rows rise with `rise` + `--i`.
- Not signed in: the empty state « Le classement de la promo », line « Crée ton compte pour voir où tu en es. », main button « Créer mon compte ».
- Signed in but hidden: a glass banner above the list « Tu n'apparais pas dans le classement. » with the button « Apparaître ».
- Nobody yet this week: « Personne n'a encore joué cette semaine. À toi d'ouvrir le bal. »

### Questions de la promo

**Ways in**: a glass button « Poser une question » in the header of Cours (right of the title); a row « Une question sur ce chapitre ? » at the bottom of each chapter page (the question then carries that chapter); a row « Questions de la promo » at the top of Cours's path that opens the list. Nothing on Accueil.

**The list (page `#cours/questions`, back to Cours)**: title « Questions de la promo »; a two-part control « Toutes » / « Sans réponse » (for the admin, a third part first: « À répondre », same list as « Sans réponse », newest last); cards newest first: the text (three lines at most), under it the pseudo, the date (« il y a 2 j ») and the chapter's title as a chip; on the right a pill « Répondu » (turquoise tint) or « En attente » (galet tint); a small « Moi aussi · 3 ». Read with `orderBy("creeLe", "desc")`, `limit(100)`, when the page opens and with « Actualiser »; the last result is kept on the phone for offline.

**A question (sheet)**: the whole text, who and when, the chapter (tapping it opens the chapter), the button « Moi aussi » (a toggle; not on my own question), then « Réponse » with the answer and its date, or « Pas encore de réponse. ». Text is selectable. The author sees « Supprimer ma question ». The admin sees a text field « Ta réponse » (2 000 characters), « Publier la réponse » (« Modifier la réponse » when one exists) and « Supprimer la question » (confirmation).

**Poser une question (sheet)**: a text field with « Ta question, comme tu la poserais en cours » as placeholder and a counter « 0/500 »; a row « Chapitre » (« Aucun » or one of the chapters; pre-filled when opened from a chapter); under the field « Toute la promo verra ta question avec ton pseudo. »; main button « Envoyer ». Success: toast « Question envoyée. », the list refreshes. Not signed in: the sheet shows instead « Il faut un compte pour poser une question. » and the two account buttons. Offline: « Pas de connexion. Réessaie quand tu as du réseau. » (keep the text typed).

**Admin**: `estAdmin()` = `admins/<cle>` exists, checked once per launch.

## Also

- `scripts/check_offline_list.py` and sw.js: the new files. Cache name +1.
- « Comment ça marche » in Profil: three short lines on the account, the classement and the questions.
- docs/TECH.md: a section « Comptes » (the files, the data, the sync rule, how to run with the fake backend). README table and « État » in CLAUDE.md as usual.
- Tests on the fake backend: creating an account (each error), signing in, sign-out, the obvious codes refused, the merge function, the classement (order, own row, hidden banner, caps on what is sent), asking, « Moi aussi », answering as admin, deleting, everything hidden when the config is empty, the app unchanged without an account. Screenshots light and dark of: the create sheet, Profil signed in, the classement, the list of questions, a question with its answer.

## Not in this phase

- No automatic answer by an AI (it needs a paid key and a server).
- No notification when a question is answered.
- No e-mail, no « mot de passe oublié » by e-mail, no sign-in with Google or Apple.
- No change to the design, the tab bar or Accueil.

## In the pull request

« En bref », « À tester sur ton téléphone » (create an account with the class code, close and reopen, do a lesson and see the XP in the classement, ask a question, sign out and in, try a wrong code of the promo, plane mode), « Choix faits », then the technical details folded. Remind the owner of step 6 of `docs/firebase/README.md` (make himself admin).
