/* =====================================================================================
   content.js: turns content/themes.json and content/questions.json into what Réviser
   shows: for each theme, its lessons (« leçon 1, 2, 3… ») and their questions.

   A question that is broken (a missing field, a wrong index...) is skipped, so one
   mistake in the file never breaks the app. The list of skipped questions is written in
   the browser console, and scripts/check_content.py finds the same problems.
   ===================================================================================== */

export const TYPES = ["qcm", "saisie", "paires"];

/** « [EXEMPLE] » at the start of a question marks sample content (see CLAUDE.md). */
const EXAMPLE_MARK = /^\s*\[EXEMPLE\]\s*/i;

const isText = (value) => typeof value === "string" && value.trim() !== "";
const asText = (value) => (typeof value === "string" ? value.trim() : "");

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

  const q = {
    id,
    theme: asText(raw.theme),
    lesson,
    type: raw.type,
    text: raw.question.replace(EXAMPLE_MARK, "").trim(),
    example: raw.status === "exemple" || EXAMPLE_MARK.test(raw.question),
    hint: asText(raw.hint),
    explanation: asText(raw.explanation),
    study: isText(raw.study) ? raw.study.trim() : null,
    source: asText(raw.source),
  };

  if (q.type === "qcm") {
    const choices = Array.isArray(raw.choices) ? raw.choices.filter(isText).map((c) => c.trim()) : [];
    if (choices.length < 2 || choices.length !== raw.choices.length) return fail("« choices » doit contenir au moins 2 textes");
    const correct = Array.isArray(raw.correct) ? [...new Set(raw.correct.map(Number))] : [];
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
  return q;
}

/**
 * Builds the content of Réviser.
 *   themes        content of content/themes.json
 *   rawQuestions  content of content/questions.json
 * Returns {
 *   themes: [{ id, title, index, lessons: [{ key, theme, number, index, questions }], questionCount }],
 *   theme(id), lesson(key), question(id), hasExamples, problems
 * }
 */
export function createReviserContent(themes, rawQuestions) {
  const problems = [];
  const themeIds = new Set(themes.map((t) => t.id));
  const byId = new Map();

  for (const raw of Array.isArray(rawQuestions) ? rawQuestions : []) {
    const q = cleanQuestion(raw, problems);
    if (!q) continue;
    if (byId.has(q.id)) { problems.push(`${q.id} : id déjà utilisé`); continue; }
    if (!themeIds.has(q.theme)) { problems.push(`${q.id} : thème inconnu « ${q.theme} »`); continue; }
    byId.set(q.id, q);
  }
  if (problems.length) console.warn("Réviser : questions ignorées\n- " + problems.join("\n- "));

  const all = [...byId.values()];
  const lessonsByKey = new Map();
  const list = themes.map((theme, i) => {
    const questions = all.filter((q) => q.theme === theme.id);
    const numbers = [...new Set(questions.map((q) => q.lesson))].sort((a, b) => a - b);
    const lessons = numbers.map((number, j) => {
      const lesson = {
        key: `${theme.id}:${number}`,     // saved in the progress, so it never changes
        theme: theme.id,
        number,
        index: j + 1,                     // shown on screen: « Leçon 1, 2, 3… »
        questions: questions.filter((q) => q.lesson === number),
      };
      lessonsByKey.set(lesson.key, lesson);
      return lesson;
    });
    return { id: theme.id, title: theme.title, index: i + 1, lessons, questionCount: questions.length };
  });

  return {
    themes: list,
    theme: (id) => list.find((t) => t.id === id) || null,
    lesson: (key) => lessonsByKey.get(key) || null,
    question: (id) => byId.get(id) || null,
    hasExamples: all.some((q) => q.example),
    total: all.length,
    problems,
  };
}
