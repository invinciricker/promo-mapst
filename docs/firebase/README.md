# Firebase: your steps

Written by Claude chat for the owner. Firebase is Google's free service that will keep the accounts, the progress, the classement and the questions (Phase 6). You do these steps **once, before** the Claude Code session of Phase 6. About 15 minutes, on a computer.

Google renames its buttons from time to time: if a name is slightly different, pick the closest one, and if you're lost, send Claude chat a screenshot.

## 1. Create the project (free, no card)

1. Open https://console.firebase.google.com and sign in with your Google account.
2. Click **Créer un projet** (or « Ajouter un projet »). Name: `promo-mapst`. Continue.
3. **Google Analytics: turn it OFF.** The app promises no trackers. Then **Créer le projet**.
4. Never click « Passer à Blaze » / « Upgrade »: the free plan is called **Spark** and it is enough (50 000 reads and 20 000 writes a day; a class uses a few hundred).

## 2. Turn on sign-in

1. Left menu: **Créer** > **Authentication** > **Commencer**.
2. Tab **Mode de connexion** (Sign-in method): click **Adresse e-mail/Mot de passe**, turn on the first switch only, **Enregistrer**. (The app never asks for an e-mail: it builds a hidden address from the pseudo.)

## 3. Create the database in Europe

1. Left menu: **Créer** > **Firestore Database** > **Créer une base de données**.
2. Edition: Standard. Location: **eur3 (Europe)**. This choice is final.
3. Choose **mode production** (everything locked), then **Créer**.
4. Tab **Règles**: delete everything in the box, paste the whole content of `docs/firebase/firestore.rules` from the repository, click **Publier**.

## 4. Choose the class code

1. Pick a code that you will give to the class by voice or in your group: 4 to 20 letters, digits or hyphens, for example `mapst-nice-27` (choose your own).
2. Tab **Données** > **Commencer une collection**. Collection ID: `codes`. Next.
3. Document ID: **your code, exactly**. Add one field: name `actif`, type boolean, value true. **Enregistrer**.

To change the code later: add a new document, delete the old one. People who already have an account keep it.

## 5. Get the app's settings

1. The gear at the top left > **Paramètres du projet**.
2. At the bottom, « Vos applications »: click the **</>** icon (Web). Name: `Promo MAPST`. Do NOT tick « Firebase Hosting ». **Enregistrer l'application**.
3. A block `const firebaseConfig = { apiKey: "...", ... }` appears. Copy it: you paste it in the prompt of the Claude Code session.

This block is **not a secret**: every Firebase web app shows it. What protects the data is the rules of step 3.

## 6. After the phase is merged: make yourself admin

1. In the app, create your account (Profil > Créer mon compte).
2. In the console: Firestore Database > Données > **Commencer une collection**. Collection ID: `admins`. Document ID: **your pseudo in lowercase**. One field: `depuis`, type string, today's date. Enregistrer.
3. Close and reopen the app: « À répondre » appears in Questions de la promo.

## When someone forgets their code (PIN)

Nobody can read a PIN, not even you. To give a new one:

1. Console > Authentication > **Utilisateurs**. Find the line `their-pseudo@promo-mapst.example.com`.
2. The three dots at the end of the line > **Supprimer le compte**. (Their progress is not deleted: it is kept under their pseudo.)
3. Straight away, with them: in the app, **Créer mon compte** with the **same pseudo**, a new PIN and the class code. Their progress comes back.

Do steps 2 and 3 together with the person, so nobody else takes the pseudo in between.

## What is stored

A pseudo, a PIN (scrambled by Google, unreadable), the quiz and lesson progress, the XP of the week for those who chose the classement, and the questions asked. No e-mail, no name, no phone number. Everything is in Europe. « Supprimer mon compte » in Profil deletes all of it.
