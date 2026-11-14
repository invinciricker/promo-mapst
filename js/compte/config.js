/* =====================================================================================
   config.js: the settings of the Firebase project of the app (Phase 6).

   firebaseConfig is the block the owner copied from the Firebase console (Paramètres du
   projet › Vos applications › Promo MAPST). It is NOT a secret: every Firebase web app
   shows it. What protects the data is the database rules (docs/firebase/firestore.rules).

   To switch every account feature off: empty the values (apiKey: "", projectId: ""...).
   The app then hides the account, the classement and the questions, and works as before.

   DOMAINE: an account is a pseudo; Firebase needs an e-mail address, so the app builds a
   hidden one, <pseudo in lowercase>@promo-mapst.example.com. example.com can never
   receive mail, so no reset e-mail can leak. It is never shown.
   ===================================================================================== */

export const firebaseConfig = {
  apiKey: "AIzaSyB9hPPRiKNmUrptyPGZrlLViKsFSs52Eyg",
  authDomain: "promo-mapst.firebaseapp.com",
  databaseURL: "https://promo-mapst-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "promo-mapst",
  storageBucket: "promo-mapst.firebasestorage.app",
  messagingSenderId: "1027898890124",
  appId: "1:1027898890124:web:f8cd9f27cafe1fec5ce8a9",
};

export const DOMAINE = "promo-mapst.example.com";
