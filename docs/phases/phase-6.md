# Phase 6: comptes, classement et questions (draft)

A draft, kept from the original brief (it was « Phase 4 », then « Phase 5 », until 13 Nov 2026) with the « Questions » part added. Claude chat finishes it, with a prototype, before the phase starts.

## Comptes
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

## Questions de la promo (new, 12 Nov 2026)
The owner wants classmates to be able to ask a question about the course from the app, to see who asked what, and to add his own answers.
- « Poser une question » : a glass button at the top of Cours and a row at the bottom of each chapter (the question then carries that chapter). Not on Accueil, which stays bare. The questions can be about anything, in plain language. A question is a short text (500 characters at most) with an optional theme. It needs an account.
- Questions are saved in Firestore with the username and the date. Everyone signed in sees the list « Questions de la promo », newest first, with « En attente » or « Répondu ». « Moi aussi » adds a +1.
- The owner's account is marked as admin by hand in the Firebase console. He sees « À répondre », writes or edits answers, and can delete a question.
- Security rules: only signed-in members of the class read and write; only the admin answers and deletes.
- An automatic first answer by Claude, from the course files, is **not** in this phase: it needs a paid API key and a small server (see docs/PLAN.md, « Decisions waiting for the owner »).
