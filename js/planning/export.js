/* =====================================================================================
   export.js: the sheet « Ajouter à ton agenda ».

   The file content/planning.ics is made by scripts/export_planning.py with the same data
   as the app. Two ways to use it:
     - subscribe: the phone's calendar reads the file regularly, so changes arrive by
       themselves (Apple Calendar via a webcal:// link, Google Agenda via the link);
     - download: a one-time copy to import.
   ===================================================================================== */

import { esc, icon, isIOS, isAndroid, copyText } from "../core/dom.js";
import { openSheet } from "../core/sheet.js";
import { showToast } from "../core/toast.js";

export function openExportSheet() {
  const url = new URL("content/planning.ics", location.href);
  url.hash = "";
  const httpsLink = url.href;
  const webcalLink = httpsLink.replace(/^https?:/, "webcal:");
  const ios = isIOS();

  const apple = `
    <div class="option">
      <div class="option__head">
        <span class="list__icon tone-blue">${icon("repeat")}</span>
        <div><p class="option__title">iPhone, iPad ou Mac</p>
        <p class="option__text">Abonnement au planning : il se met à jour tout seul.</p></div>
      </div>
      <a class="btn btn--primary btn--block" href="${esc(webcalLink)}">${icon("export")}Ajouter à Calendrier</a>
      <ol class="steps"><li><span>Touche le bouton ci-dessus.</span></li><li><span>Choisis « S’abonner », puis « Ajouter ».</span></li></ol>
    </div>`;

  const google = `
    <div class="option">
      <div class="option__head">
        <span class="list__icon tone-turquoise">${icon("repeat")}</span>
        <div><p class="option__title">Google Agenda (Android)</p>
        <p class="option__text">Abonnement au planning : il se met à jour tout seul (en quelques heures).</p></div>
      </div>
      <div class="copy-field"><span class="copy-field__url">${esc(httpsLink)}</span>
        <button type="button" class="btn btn--secondary btn--small" data-copy>${icon("copy")}Copier</button></div>
      <ol class="steps">
        <li><span>Copie le lien ci-dessus et envoie-le toi (par message ou par mail).</span></li>
        <li><span>Sur un ordinateur, ouvre calendar.google.com.</span></li>
        <li><span>À gauche, à côté de « Autres agendas », clique sur « + », puis « À partir de l’URL ».</span></li>
        <li><span>Colle le lien, puis clique sur « Ajouter l’agenda ».</span></li>
        <li><span>Sur ton téléphone, dans l’appli Google Agenda : Menu › Paramètres › Promo MAPST › active « Synchroniser ».</span></li>
      </ol>
    </div>`;

  const download = `
    <div class="option">
      <div class="option__head">
        <span class="list__icon tone-lavande">${icon("download")}</span>
        <div><p class="option__title">Fichier .ics</p>
        <p class="option__text">Une copie du planning d’aujourd’hui, à importer une fois. S’il change, il faudra recommencer.</p></div>
      </div>
      <a class="btn btn--secondary btn--block" href="content/planning.ics"
        ${ios ? 'target="_blank" rel="noopener"' : 'download="promo-mapst-planning.ics"'}>${icon("download")}Télécharger planning.ics</a>
    </div>`;

  // The option for this phone comes first.
  const options = isAndroid() ? [google, apple, download] : ios ? [apple, google, download] : [google, apple, download];
  const body = `
    <p class="option__text" style="font-size:15px">Ajoute toute la formation dans l’agenda de ton téléphone. Tes événements perso n’y sont pas : ils restent dans l’appli.</p>
    ${options.join("")}
    <p class="footer">Appli non officielle : en cas de doute, vérifie dans tes cours.</p>`;

  const sheet = openSheet({ title: "Ajouter à ton agenda", body });
  sheet.body.addEventListener("click", async (event) => {
    if (!event.target.closest("[data-copy]")) return;
    const ok = await copyText(httpsLink);
    showToast(ok ? "Lien copié" : "Copie impossible : sélectionne le lien à la main");
  });
}
