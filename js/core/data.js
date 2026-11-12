/* =====================================================================================
   data.js: the content loaded from content/ by app.js, shared by every screen.

   The screens read it when they draw themselves, so they always use the latest version
   (app.js fetches the content again when the app comes back after a while).
     data.model     the planning, ready to use (js/planning/model.js), or null
     data.reviser   the themes, lessons and questions of Réviser (js/reviser/content.js)
     data.themes    content/themes.json as written in the file
     data.cours     the path of chapters and their documents (js/cours/content.js)
     data.mots      the owner's short lines for Accueil (content/mots.json)
     data.facts     the « Le savais-tu ? » facts for Accueil (content/savais-tu.json)
   ===================================================================================== */

export const data = {
  model: null,
  reviser: null,
  themes: [],
  cours: null,
  mots: [],
  facts: [],
};
