/* =====================================================================================
   data.js: the content loaded from content/ by app.js, shared by every screen.

   The screens read it when they draw themselves, so they always use the latest version
   (app.js fetches the content again when the app comes back after a while).
     data.model     the planning, ready to use (js/planning/model.js), or null
     data.reviser   the themes, lessons and questions of Réviser (js/reviser/content.js)
     data.themes    content/themes.json as written in the file
   ===================================================================================== */

export const data = {
  model: null,
  reviser: null,
  themes: [],
};
