/* =====================================================================================
   content.js: turns content/themes.json and content/questions.json into what Réviser
   shows: for each theme, its lessons (« Leçon 1, 2, 3… ») and their questions, and the
   colour and icon of each theme.

   Who sees which question (the "status" of each question, see CLAUDE.md):
     "verifie"    checked by the owner.
     "brouillon"  written by Claude chat, not checked yet. Since 7 Nov 2026 everyone sees
                  them like "verifie" ones (the owner checks them later in Relecture).
                  A lesson appears once it has at least MIN_QUESTIONS of these two,
                  so nobody gets a half-empty lesson.
     "exemple"    sample content: everyone sees it, with an « Exemple » badge.
   In « Mode relecture » (Profil), every lesson is shown and open, and the "brouillon"
   questions get an « À vérifier » badge and the « Juste / À corriger » buttons.
   A missing or unknown status counts as "brouillon".

   A question that is broken (a missing field, a wrong index...) is skipped, so one
   mistake in the file never breaks the app. The list of skipped questions is written in
   the browser console, and scripts/check_content.py finds the same problems.
   ===================================================================================== */

export const TYPES = ["qcm", "saisie", "paires"];
export const STATUSES = ["brouillon", "verifie", "exemple"];

/** A lesson is shown once it has this many "verifie" or "brouillon" questions. */
export const MIN_QUESTIONS = 5;

/**
 * The colour of each theme follows its place in themes.json (docs/design/README.md):
 * a new theme gets the next colour and the default icon, with no change to the code.
 */
export const THEME_TONES = ["bougainvillier", "soleil", "lavande", "turquoise", "azur", "olivier"];
const THEME_ICONS = {
  "anatomie-mouvement": "figure",
  "filieres-energetiques": "battery",
  "publics": "users",
  "entretien-corporel": "dumbbell",
  "role-educateur": "shield",
  "fiche-de-seance": "clipboard",
};
export const themeTone = (index) => THEME_TONES[(index - 1) % THEME_TONES.length];
export const themeIcon = (id) => THEME_ICONS[id] || "bolt";

/** « [EXEMPLE] » at the start of a question marks sample content (see CLAUDE.md). */
const EXAMPLE_MARK = /^\s*\[EXEMPLE\]\s*/i;

const isText = (value) => typeof value === "string" && value.trim() !== "";
const asText = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * A short "fingerprint" of what a question says: 8 letters and digits that change as
 * soon as its text, choices, answers, hint or explanation change. The Relecture verdicts
 * are saved with it, so a verdict disappears when Claude chat rewrites the question.
 * (Its status, lesson and source are left out: changing them changes nothing to check.)
 */
export function fingerprint(q) {
  const data = JSON.stringify([q.type, q.text, q.choices || null, q.correct || null,
    q.answers || null, q.pairs || null, q.hint, q.explanation]);
  let hash = 0x811c9dc5;                       // FNV-1a, a classic tiny hash
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Checks one question; returns a clean copy, or null (and a reason) if it is broken. */
function cleanQuestion(raw, problems) {
  if (!raw || typeof raw !== "object") {
    problems.push("une question n’est pas un objet { … }");
    return null;
  }
  const id = asText(raw.id);
  const fail = (why) => { problems.push(`${id || "(sans id)"} : ${why}`); return null; };
  if (!id) return fail("pas d’id");
  if (!TYPES.includes(raw.type)) return fail(`type inconnu « ${raw.type} »`);
  const lesson = Number(raw.lesson);
  if (!Number.isInteger(lesson) || lesson < 1) return fail("« lesson » doit être 1, 2, 3…");
  if (!isText(raw.question)) return fail("pas de question");

  const status = STATUSES.includes(raw.status) ? raw.status : "brouillon";
  const q = {
    id,
    theme: asText(raw.theme),
    lesson,
    type: raw.type,
    status,
    draft: status === "brouillon",          // not checked yet: « À vérifier » in Relecture
    text: raw.question.replace(EXAMPLE_MARK, "").trim(),
    example: status === "exemple" || EXAMPLE_MARK.test(raw.question),
    hint: asText(raw.hint),
    explanation: asText(raw.explanation),
    study: isText(raw.study) ? raw.study.trim() : null,
    source: asText(raw.source),
  };

  if (q.type === "qcm") {
    const choices = Array.isArray(raw.choices) ? raw.choices.filter(isText).map((c) => c.trim()) : [];
    if (choices.length < 2 || choices.length !== raw.choices.length) return fail("« choices » doit contenir au moins 2 textes");
    const correct = Array.isArray(raw.correct) ? [...new Set(raw.correct.map(Number))].sort((a, b) => a - b) : [];
    if (!correct.length || correct.some((i) => !Number.isInteger(i) || i < 0 || i >= choices.length)) {
      return fail("« correct » doit donner le numéro des bonnes réponses (0 = la première)");
    }
    q.choices = choices;
    q.correct = correct;
  } else if (q.type === "saisie") {
    const answers = Array.isArray(raw.answers) ? raw.answers.filter(isText).map((a) => a.trim()) : [];
    if (!answers.length) return fail("« answers » doit contenir au moins une réponse");
    q.answers = answers;
  } else {
    const pairs = Array.isArray(raw.pairs)
      ? raw.pairs.filter((p) => Array.isArray(p) && p.length === 2 && isText(p[0]) && isText(p[1]))
        .map((p) => [p[0].trim(), p[1].trim()])
      : [];
    if (pairs.length < 2 || pairs.length !== raw.pairs.length) return fail("« pairs » doit être une liste de [gauche, droite]");
    const unique = (side) => new Set(pairs.map((p) => p[side].toLowerCase())).size === pairs.length;
    if (!unique(0) || !unique(1)) return fail("deux paires ont le même texte");
    q.pairs = pairs;
  }
  q.fingerprint = fingerprint(q);
  return q;
}

/** The lesson titles of a theme (themes.json, "lessons": [{ "n": 1, "title": "…" }]). */
function lessonTitles(theme) {
  const titles = new Map();
  for (const item of Array.isArray(theme.lessons) ? theme.lessons : []) {
    const n = Number(item && item.n);
    if (Number.isInteger(n) && n >= 1 && isText(item.title)) titles.set(n, item.title.trim());
  }
  return titles;
}

/**
 * Builds the content of Réviser.
 *   themes        content of content/themes.json
 *   rawQuestions  content of content/questions.json
 *   relecture     true in « Mode relecture » (every lesson shown and open)
 * Returns {
 *   themes: [{ id, title, index, tone, icon, lessons, questionCount }]   in order
 *     each lesson: { key, theme, number, title, label, questions, draftCount }
 *   theme(id), lesson(key), question(id)   only what is shown (null otherwise)
 *   lessonLabel(themeId, number)           « Os et articulations », or « Leçon 2 »
 *   all      every valid question, whatever its status (in the order of the file)
 *   drafts   the "brouillon" questions, for the Relecture report
 *   relecture, total (questions shown), hasExamples, problems
 * }
 */
export function createReviserContent(themes, rawQuestions, { relecture = false } = {}) {
  const problems = [];
  const themeList = (Array.isArray(themes) ? themes : []).filter((t) => t && isText(t.id) && isText(t.title));
  const themeIds = new Set(themeList.map((t) => t.id));
  const all = [];
  const seen = new Set();

  for (const raw of Array.isArray(rawQuestions) ? rawQuestions : []) {
    const q = cleanQuestion(raw, problems);
    if (!q) continue;
    if (seen.has(q.id)) { problems.push(`${q.id} : id déjà utilisé`); continue; }
    if (!themeIds.has(q.theme)) { problems.push(`${q.id} : thème inconnu « ${q.theme} »`); continue; }
    seen.add(q.id);
    all.push(q);
  }
  if (problems.length) console.warn("Réviser : questions ignorées\n- " + problems.join("\n- "));

  const titlesByTheme = new Map(themeList.map((t) => [t.id, lessonTitles(t)]));
  const lessonLabel = (themeId, number) => {
    const titles = titlesByTheme.get(themeId);
    return (titles && titles.get(number)) || `Leçon ${number}`;
  };

  const shownById = new Map();
  const lessonsByKey = new Map();
  const list = themeList.map((theme, i) => {
    const mine = all.filter((q) => q.theme === theme.id);
    const numbers = [...new Set(mine.map((q) => q.lesson))].sort((a, b) => a - b);
    const lessons = [];
    for (const number of numbers) {
      const inLesson = mine.filter((q) => q.lesson === number);
      if (!relecture) {
        const real = inLesson.filter((q) => q.status === "verifie" || q.status === "brouillon").length;
        const samples = inLesson.some((q) => q.status === "exemple");
        if (real < MIN_QUESTIONS && !samples) continue;         // not ready for the class yet
      }
      const questions = inLesson;
      const titles = titlesByTheme.get(theme.id);
      const lesson = {
        key: `${theme.id}:${number}`,       // to find the lesson again (never saved)
        theme: theme.id,
        number,                             // the "lesson" of the questions: « Leçon 2 »
        title: (titles && titles.get(number)) || "",
        label: lessonLabel(theme.id, number),
        questions,
        draftCount: questions.filter((q) => q.draft).length,
      };
      lessons.push(lesson);
      lessonsByKey.set(lesson.key, lesson);
      questions.forEach((q) => shownById.set(q.id, q));
    }
    return {
      id: theme.id,
      title: theme.title.trim(),
      index: i + 1,
      tone: themeTone(i + 1),             // its colour: "bougainvillier", "soleil"...
      icon: themeIcon(theme.id),          // its icon (index.html: #i-figure...)
      lessons,
      questionCount: lessons.reduce((sum, l) => sum + l.questions.length, 0),
    };
  });

  return {
    themes: list,
    theme: (id) => list.find((t) => t.id === id) || null,
    lesson: (key) => lessonsByKey.get(key) || null,
    question: (id) => shownById.get(id) || null,
    lessonLabel,
    all,
    drafts: all.filter((q) => q.draft),
    relecture,
    total: shownById.size,
    hasExamples: [...shownById.values()].some((q) => q.example),
    problems,
  };
}
