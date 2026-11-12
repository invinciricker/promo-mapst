#!/usr/bin/env python3
"""
Checks the content of Réviser before you publish it:
    python3 scripts/check_content.py
    python3 scripts/check_content.py path/to/content     (another folder, used by the tests)

It reads content/themes.json, content/questions.json, content/planning-fixes.json and the
four files of Phase 4 (parcours.json, documents.json, mots.json, savais-tu.json), and prints:
  - every PROBLEM it finds (a missing field, a wrong index, an unknown theme, a gap in the
    lesson numbers, a hint that gives the answer...), with the id of the question;
  - WARNINGS: things to look at, which do not block (a lesson title without questions,
    a wrong answer that the « one typo » rule would accept...);
  - a summary: for each theme and lesson, how many questions, their status, and whether
    the class can see the lesson yet (since 7 Nov 2026 everyone sees "brouillon" and
    "verifie" questions; a lesson appears once it has 5 of them).
  - the corrections of the planning (content/planning-fixes.json): their format, and
    whether content/planning.json already has them.
  - Cours and Accueil (Phase 4): the path of chapters (parcours.json), the documents
    (documents.json), the owner's lines (mots.json) and the facts (savais-tu.json).

If there is at least one problem, it ends with an error: GitHub shows a red cross on the
pull request (see .github/workflows/checks.yml) and the problems are in its log.
The app itself skips a broken question instead of crashing, but it is better to fix it:
a skipped question is simply missing for everyone.
The formats are described in CLAUDE.md (« Content formats »).
"""
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "content"
TYPES = ("qcm", "saisie", "paires")
STATUSES = ("brouillon", "verifie", "exemple")
MIN_QUESTIONS = 5          # same rule as js/reviser/content.js: shown with 5 "verifie" or "brouillon"
TYPO_MIN_LENGTH = 8        # same rule as js/reviser/answer.js: one typo forgiven from 8 letters
problems = []
warnings = []


def load(name):
    path = CONTENT / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        problems.append(f"{name}: file not found")
    except json.JSONDecodeError as error:
        problems.append(f"{name}: not valid JSON (line {error.lineno}, column {error.colno}: {error.msg})")
    return None


def text(value):
    return isinstance(value, str) and value.strip() != ""


def whole_number(value):
    return isinstance(value, int) and not isinstance(value, bool)


# ---- How the app compares typed answers (same rules as js/reviser/answer.js) -----------
LEADING_ARTICLE = re.compile(r"^(?:l'|d'|le |la |les |un |une |des |du |de la |de l')")
ARTICLE_WORDS = {"l", "d", "le", "la", "les", "un", "une", "des", "du", "de"}


def plain(value):
    """Lower case, no accents, straight apostrophes, single spaces."""
    t = unicodedata.normalize("NFKD", str(value))
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.replace("’", "'").replace("‘", "'").lower()
    return re.sub(r"\s+", " ", t).strip()


def squash(value):
    """Only letters and digits: « La loi de Wolff ! » -> "loidewolff" (like the app)."""
    t = plain(value).replace("œ", "oe").replace("æ", "ae")
    t = LEADING_ARTICLE.sub("", t)
    return re.sub(r"[^a-z0-9]", "", t)


def words(value):
    t = plain(value).replace("œ", "oe").replace("æ", "ae")
    return re.findall(r"[a-z0-9]+", t)


def one_typo_away(a, b):
    """At most one letter added, missing, changed, or two neighbours swapped."""
    if a == b:
        return True
    if abs(len(a) - len(b)) > 1:
        return False
    d = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        d[i][0] = i
    for j in range(len(b) + 1):
        d[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)
    return d[len(a)][len(b)] <= 1


def join_letters(tokens):
    """« s d j e s » (from « S.D.J.E.S. ») -> « sdjes »: single letters in a row make one word."""
    joined = []
    for token in tokens:
        if len(token) == 1 and joined and joined[-1][1]:
            joined[-1] = (joined[-1][0] + token, True)
        else:
            joined.append((token, len(token) == 1))
    return [token for token, _ in joined]


def hint_gives_answer(hint, answer):
    """True if the hint contains the answer (whole words, a final s or x allowed)."""
    target = words(answer)
    while len(target) > 1 and target[0] in ARTICLE_WORDS:
        target = target[1:]
    if not target:
        return False
    n = len(target)
    for hint_words in (words(hint), join_letters(words(hint))):
        for i in range(len(hint_words) - n + 1):
            chunk = hint_words[i:i + n]
            last = chunk[-1]
            if chunk[:-1] == target[:-1] and last in (target[-1], target[-1] + "s", target[-1] + "x"):
                return True
    # Answers written with dots or dashes (« S.D.J.E.S. », « VO2 max »): compare letters only.
    short = squash(answer)
    return len(short) >= 6 and short in squash(hint)


# ---- Read the files ---------------------------------------------------------------------
themes = load("themes.json") or []
questions = load("questions.json") or []
if not isinstance(themes, list):
    problems.append("themes.json: must be a list [ ... ] of themes")
    themes = []
if not isinstance(questions, list):
    problems.append("questions.json: must be a list [ ... ] of questions")
    questions = []

theme_ids = []
titles = {}                 # theme id -> {lesson number: title}
for i, theme in enumerate(themes):
    if not isinstance(theme, dict) or not text(theme.get("id")) or not text(theme.get("title")):
        problems.append(f"themes.json, item {i + 1}: needs an \"id\" and a \"title\"")
        continue
    tid = theme["id"]
    if tid in theme_ids:
        problems.append(f"themes.json: the id \"{tid}\" is used twice")
    theme_ids.append(tid)
    titles[tid] = {}
    lessons = theme.get("lessons")
    if lessons is None:
        continue
    if not isinstance(lessons, list):
        problems.append(f"themes.json, {tid}: \"lessons\" must be a list of {{ \"n\", \"title\" }}")
        continue
    for item in lessons:
        if not isinstance(item, dict) or not whole_number(item.get("n")) or item["n"] < 1 or not text(item.get("title")):
            problems.append(f"themes.json, {tid}: each lesson title needs \"n\" (1, 2, 3...) and a \"title\", found {json.dumps(item, ensure_ascii=False)}")
        elif item["n"] in titles[tid]:
            problems.append(f"themes.json, {tid}: two titles for lesson {item['n']}")
        else:
            titles[tid][item["n"]] = item["title"].strip()

study_ids = None
study_index = CONTENT / "study" / "index.json"
if study_index.is_file():
    try:
        study_ids = {p.get("id") for p in json.loads(study_index.read_text(encoding="utf-8")) if isinstance(p, dict)}
    except (json.JSONDecodeError, TypeError):
        study_ids = None     # Phase 3 has its own checks for this file

seen = set()
by_lesson = defaultdict(lambda: defaultdict(list))   # theme -> lesson -> [questions]
types = defaultdict(int)
statuses = defaultdict(int)

for i, q in enumerate(questions):
    where = f"question {i + 1}"
    if not isinstance(q, dict):
        problems.append(f"{where}: is not an object {{...}}")
        continue
    qid = q.get("id")
    if text(qid):
        where = qid
        if qid in seen:
            problems.append(f"{where}: this id is used twice")
        seen.add(qid)
    else:
        problems.append(f"{where}: needs an \"id\"")

    if q.get("theme") not in theme_ids:
        problems.append(f"{where}: unknown theme \"{q.get('theme')}\" (see themes.json)")
    lesson = q.get("lesson")
    if not whole_number(lesson) or lesson < 1:
        problems.append(f"{where}: \"lesson\" must be a whole number (1, 2, 3...)")
    if not text(q.get("question")):
        problems.append(f"{where}: \"question\" is empty")
    for field in ("hint", "explanation", "source"):
        if field in q and not isinstance(q[field], str):
            problems.append(f"{where}: \"{field}\" must be a text")
    if not text(q.get("explanation")):
        problems.append(f"{where}: \"explanation\" is empty (one sentence is shown after each answer)")
    status = q.get("status")
    if status not in STATUSES:
        problems.append(f"{where}: \"status\" must be \"brouillon\", \"verifie\" or \"exemple\"")
    else:
        statuses[status] += 1
    marked = text(q.get("question")) and q["question"].lstrip().upper().startswith("[EXEMPLE]")
    if marked != (status == "exemple"):
        warnings.append(f"{where}: sample content starts with « [EXEMPLE] » AND has the status \"exemple\" (one of the two is missing)")
    if "study" in q and q["study"] is not None:
        if not isinstance(q["study"], str):
            problems.append(f"{where}: \"study\" must be the id of a study page (a text)")
        elif study_ids is not None and q["study"] not in study_ids:
            warnings.append(f"{where}: \"study\" is \"{q['study']}\", but content/study/index.json has no page with that id")

    kind = q.get("type")
    if kind not in TYPES:
        problems.append(f"{where}: \"type\" must be \"qcm\", \"saisie\" or \"paires\"")
    elif kind == "qcm":
        choices = q.get("choices")
        correct = q.get("correct")
        if not isinstance(choices, list) or len(choices) < 2 or not all(text(c) for c in choices):
            problems.append(f"{where}: \"choices\" needs at least 2 texts (4 is the rule)")
        else:
            if len(choices) != 4:
                problems.append(f"{where}: {len(choices)} choices (the rule is 4)")
            if len({plain(c) for c in choices}) != len(choices):
                problems.append(f"{where}: two choices have the same text")
        if not isinstance(correct, list) or not correct:
            problems.append(f"{where}: \"correct\" needs the index of at least one right choice (0 = the first)")
        elif isinstance(choices, list):
            for index in correct:
                if not whole_number(index) or not 0 <= index < len(choices):
                    problems.append(f"{where}: \"correct\" has {index!r}, but the choices go from 0 to {len(choices) - 1}")
            if len(set(map(str, correct))) != len(correct):
                problems.append(f"{where}: an index appears twice in \"correct\"")
            elif len(choices) > 1 and len(correct) == len(choices):
                warnings.append(f"{where}: every choice is right: is it really a question?")
    elif kind == "saisie":
        answers = q.get("answers")
        if not isinstance(answers, list) or not answers or not all(text(a) for a in answers):
            problems.append(f"{where}: \"answers\" needs at least one accepted answer (the main one first)")
            answers = []
        if not text(q.get("hint")):
            problems.append(f"{where}: a « Réponse à taper » needs a \"hint\" (a clue that does not give the answer)")
        else:
            for answer in answers:
                if hint_gives_answer(q["hint"], answer):
                    problems.append(f"{where}: the hint contains the accepted answer « {answer} »: it must not give the answer away")
    elif kind == "paires":
        pairs = q.get("pairs")
        if not isinstance(pairs, list) or len(pairs) < 2 or not all(
                isinstance(p, list) and len(p) == 2 and text(p[0]) and text(p[1]) for p in pairs):
            problems.append(f"{where}: \"pairs\" needs a list of [left, right] texts (4 is the rule)")
        else:
            if len(pairs) != 4:
                problems.append(f"{where}: {len(pairs)} pairs (the rule is 4)")
            lefts = [p[0].strip().lower() for p in pairs]
            rights = [p[1].strip().lower() for p in pairs]
            if len(set(lefts)) != len(lefts) or len(set(rights)) != len(rights):
                problems.append(f"{where}: two pairs have the same text: each side must be different")

    if q.get("theme") in theme_ids and whole_number(lesson) and lesson >= 1:
        by_lesson[q["theme"]][lesson].append(q)
    if kind in TYPES:
        types[kind] += 1

# ---- Lessons: numbered 1, 2, 3... without gaps; titles for lessons that exist ----------
for tid in theme_ids:
    numbers = sorted(by_lesson[tid])
    if numbers and numbers != list(range(1, len(numbers) + 1)):
        missing = sorted(set(range(1, numbers[-1] + 1)) - set(numbers))
        problems.append(f"{tid}: the lessons are {', '.join(map(str, numbers))}; they must start at 1 and follow"
                        f" each other (missing: {', '.join(map(str, missing))})")
    for n, title in sorted(titles.get(tid, {}).items()):
        if n not in by_lesson[tid]:
            warnings.append(f"themes.json, {tid}: lesson {n} « {title} » has a title but no question yet")


# ---- Wrong answers the « one typo » rule would accept ------------------------------------
def phrases(value, size):
    """The groups of `size` words of a text, as written (« les ostéoclastes »)."""
    parts = [w.strip("«»“”\"()[]?!.,;:…") for w in str(value).split()]
    parts = [w for w in parts if w]
    return [" ".join(parts[i:i + size]) for i in range(len(parts) - size + 1)]


everything = []      # texts from the whole file: choices, pairs, other answers
for q in questions:
    if not isinstance(q, dict):
        continue
    if isinstance(q.get("choices"), list):
        everything += [c for c in q["choices"] if text(c)]
    if isinstance(q.get("pairs"), list):
        everything += [s for p in q["pairs"] if isinstance(p, list) for s in p if text(s)]
    if isinstance(q.get("answers"), list):
        everything += [a for a in q["answers"] if text(a)]

for q in questions:
    if not isinstance(q, dict) or q.get("type") != "saisie" or not isinstance(q.get("answers"), list):
        continue
    accepted = {squash(a) for a in q["answers"] if text(a)}
    sources = [q.get("question"), q.get("hint"), q.get("explanation")] + everything
    reported = set()
    for answer in q["answers"]:
        if not text(answer):
            continue
        target = squash(answer)
        if len(target) < TYPO_MIN_LENGTH:
            continue
        for size in range(1, len(words(answer)) + 2):
            for source in sources:
                if not text(source):
                    continue
                for phrase in phrases(source, size):
                    short = squash(phrase)
                    if not short or short in accepted or short in reported:
                        continue
                    if short in (target + "s", target + "x") or target in (short + "s", short + "x"):
                        continue          # a plural is the same answer
                    if one_typo_away(short, target):
                        reported.add(short)
                        warnings.append(f"{q.get('id')}: « {phrase} » would be accepted as a typo of « {answer} »"
                                        " (one letter apart). If it is a wrong answer, think of another"
                                        " question type or another wording.")

# ---- Summary ------------------------------------------------------------------------------
print(f"{len(questions)} questions, {len(theme_ids)} themes"
      f" ({types['qcm']} QCM, {types['saisie']} à taper, {types['paires']} à associer;"
      f" {statuses['verifie']} verifie, {statuses['brouillon']} brouillon, {statuses['exemple']} exemple)")
for tid in theme_ids:
    lessons = by_lesson.get(tid, {})
    if not lessons:
        print(f"  {tid}: no question yet (the app says « Questions en préparation »)")
        continue
    print(f"  {tid}:")
    for n in sorted(lessons):
        items = lessons[n]
        count = defaultdict(int)
        for q in items:
            count[q.get("status")] += 1
        detail = ", ".join(f"{count[s]} {s}" for s in STATUSES if count[s])
        title = titles.get(tid, {}).get(n)
        shown = count["verifie"] + count["brouillon"] >= MIN_QUESTIONS or count["exemple"] > 0
        size_note = "" if 8 <= len(items) <= 10 or count["exemple"] else "; the rule is 8 to 10 questions"
        print(f"    leçon {n}{f' « {title} »' if title else ''}: {len(items)} questions ({detail})"
              f" - {'shown to the class' if shown else f'hidden from the class until it has {MIN_QUESTIONS} questions'}{size_note}")


# ---- Corrections of the planning (content/planning-fixes.json) -------------------------------
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def check_planning_fixes():
    """The format of each correction (CLAUDE.md), and whether planning.json already has it.
    scripts/export_planning.py applies them; this only checks."""
    path = CONTENT / "planning-fixes.json"
    if not path.is_file():
        return
    doc = load("planning-fixes.json")
    if doc is None:
        return
    fixes = doc.get("fixes") if isinstance(doc, dict) else None
    if not isinstance(fixes, list):
        problems.append('planning-fixes.json: must be { "about": ..., "fixes": [ ... ] }')
        return
    planning = None
    if (CONTENT / "planning.json").is_file():
        try:
            planning = json.loads((CONTENT / "planning.json").read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            problems.append("planning.json: not valid JSON")
    ids = set()
    for i, fix in enumerate(fixes):
        where = f"planning-fixes.json, fix {i + 1}"
        if not isinstance(fix, dict):
            problems.append(f"{where}: is not an object {{...}}")
            continue
        if text(fix.get("id")):
            where = f"planning-fixes.json, {fix['id']}"
            if fix["id"] in ids:
                problems.append(f"{where}: this id is used twice")
            ids.add(fix["id"])
        else:
            problems.append(f"{where}: needs an \"id\"")
        for field in ("added", "from", "to"):
            if not DATE.match(str(fix.get(field, ""))):
                problems.append(f"{where}: \"{field}\" must be a date like 2026-11-07")
        if DATE.match(str(fix.get("from", ""))) and DATE.match(str(fix.get("to", ""))) and fix["from"] > fix["to"]:
            problems.append(f"{where}: \"from\" is after \"to\"")
        for field in ("match", "set"):
            if not isinstance(fix.get(field), dict) or not fix[field]:
                problems.append(f"{where}: \"{field}\" must list fields of a half-day, like {{ \"planning\": \"MSP 1\" }}")
        if fix.get("stage") is not None and not (isinstance(fix["stage"], dict) and text(fix["stage"].get("title"))):
            problems.append(f"{where}: \"stage\" needs a \"title\" and a \"text\"")
        if fix.get("check") is not None and not (isinstance(fix["check"], dict) and text(fix["check"].get("title")) and text(fix["check"].get("text"))):
            problems.append(f"{where}: \"check\" needs a \"title\" and a \"text\"")
        if fix.get("category") is not None and not (isinstance(fix["category"], dict) and text(fix["category"].get("id")) and text(fix["category"].get("label"))):
            problems.append(f"{where}: \"category\" needs an \"id\" and a \"label\"")
        # Is it already in content/planning.json? (export_planning.py applies it)
        if planning and isinstance(fix.get("match"), dict) and isinstance(fix.get("set"), dict) and fix["match"] and DATE.match(str(fix.get("from", ""))):
            slots = [slot for key, day in planning.get("days", {}).items() if fix["from"] <= key <= str(fix.get("to", ""))
                     for slot in day.get("slots", []) if all(slot.get(k) == v for k, v in fix["match"].items())]
            if not slots:
                warnings.append(f"{where}: no half-day of planning.json matches \"match\" between {fix['from']} and {fix.get('to')}")
            elif any(slot.get(k) != v for slot in slots for k, v in fix["set"].items()):
                warnings.append(f"{where}: not applied to planning.json yet (run scripts/export_planning.py)")
    print(f"{len(fixes)} correction(s) of the planning (planning-fixes.json)")


# ---- Cours and Accueil (Phase 4): parcours, documents, mots, savais-tu -------------------------
DOC_KINDS = ("pdf", "diapo", "tableur", "doc", "video", "lien")
MOT_MAX = 110              # characters of a line of mots.json
FACT_MAX = 100             # characters of a fact of savais-tu.json


def https(value):
    return text(value) and value.strip().startswith("https://") and " " not in value.strip()


def load_if_there(name):
    """A file of Phase 4, or None when it does not exist (the made-up folders of the tests)."""
    return load(name) if (CONTENT / name).is_file() else None


def check_parcours():
    """content/parcours.json: the blocs and the chapters. Returns the chapter ids (or None)."""
    doc = load_if_there("parcours.json")
    if doc is None:
        return None
    if not isinstance(doc, dict) or not isinstance(doc.get("blocs"), list) or not isinstance(doc.get("chapitres"), list):
        problems.append('parcours.json: must be { "about": ..., "blocs": [ ... ], "chapitres": [ ... ] }')
        return None
    blocs = set()
    for i, bloc in enumerate(doc["blocs"]):
        where = f"parcours.json, bloc {i + 1}"
        if not isinstance(bloc, dict) or not text(bloc.get("id")):
            problems.append(f"{where}: needs an \"id\"")
            continue
        where = f"parcours.json, bloc {bloc['id']}"
        if bloc["id"] in blocs:
            problems.append(f"{where}: this id is used twice")
        blocs.add(bloc["id"])
        for field in ("short", "title"):
            if not text(bloc.get(field)):
                problems.append(f"{where}: needs a \"{field}\"")
    chapters = set()
    for i, chapter in enumerate(doc["chapitres"]):
        where = f"parcours.json, chapter {i + 1}"
        if not isinstance(chapter, dict) or not text(chapter.get("id")):
            problems.append(f"{where}: needs an \"id\"")
            continue
        where = f"parcours.json, chapter {chapter['id']}"
        if chapter["id"] in chapters:
            problems.append(f"{where}: this id is used twice")
        if chapter["id"] in ("documents", "general"):
            problems.append(f"{where}: this id is kept for the app, choose another one")
        chapters.add(chapter["id"])
        for field in ("title", "when", "resume"):
            if not text(chapter.get(field)):
                problems.append(f"{where}: needs a \"{field}\"")
        if chapter.get("bloc") not in blocs:
            problems.append(f"{where}: unknown bloc « {chapter.get('bloc')} »")
        if "theme" in chapter and chapter["theme"] not in theme_ids:
            problems.append(f"{where}: unknown theme « {chapter['theme']} » (see themes.json)")
    print(f"{len(chapters)} chapter(s) in {len(blocs)} bloc(s) (parcours.json)")
    return chapters


def check_documents(chapters):
    """content/documents.json: the folder of the class and each document."""
    doc = load_if_there("documents.json")
    if doc is None:
        return
    if not isinstance(doc, dict) or not isinstance(doc.get("documents"), list):
        problems.append('documents.json: must be { "about": ..., "folder": "", "documents": [ ... ] }')
        return
    folder = doc.get("folder", "")
    if folder != "" and not https(folder):
        problems.append("documents.json: \"folder\" must be empty or an address starting with https://")
    ids = set()
    for i, item in enumerate(doc["documents"]):
        where = f"documents.json, document {i + 1}"
        if not isinstance(item, dict) or not text(item.get("id")):
            problems.append(f"{where}: needs an \"id\"")
            continue
        where = f"documents.json, {item['id']}"
        if item["id"] in ids:
            problems.append(f"{where}: this id is used twice")
        ids.add(item["id"])
        if not text(item.get("title")):
            problems.append(f"{where}: needs a \"title\"")
        if item.get("chapitre") != "general" and (chapters is None or item.get("chapitre") not in chapters):
            problems.append(f"{where}: \"chapitre\" must be a chapter id of parcours.json, or \"general\"")
        if item.get("kind") not in DOC_KINDS:
            problems.append(f"{where}: \"kind\" must be one of {', '.join(DOC_KINDS)}")
        if not https(item.get("url")):
            problems.append(f"{where}: \"url\" must start with https://")
        if not DATE.match(str(item.get("added", ""))):
            problems.append(f"{where}: \"added\" must be a date like 2026-11-12")
        if "note" in item and not text(item["note"]):
            problems.append(f"{where}: \"note\" must be a short line of text (or leave it out)")
    print(f"{len(ids)} document(s) (documents.json)")


def check_mots():
    """content/mots.json: the owner's short lines for Accueil."""
    doc = load_if_there("mots.json")
    if doc is None:
        return
    if not isinstance(doc, dict) or not isinstance(doc.get("mots"), list):
        problems.append('mots.json: must be { "about": ..., "mots": [ ... ] }')
        return
    for i, mot in enumerate(doc["mots"]):
        where = f"mots.json, line {i + 1}"
        if not isinstance(mot, dict) or not text(mot.get("text")):
            problems.append(f"{where}: needs a \"text\"")
            continue
        if len(mot["text"]) > MOT_MAX:
            problems.append(f"{where}: \"text\" has {len(mot['text'])} characters, {MOT_MAX} at most")
        for field in ("label", "by"):
            if field in mot and not text(mot[field]):
                problems.append(f"{where}: \"{field}\" must be a text (or leave it out)")
    print(f"{len(doc['mots'])} line(s) for Accueil (mots.json)")


def check_facts():
    """content/savais-tu.json: the short facts shown on Accueil."""
    facts = load_if_there("savais-tu.json")
    if facts is None:
        return
    if not isinstance(facts, list):
        problems.append("savais-tu.json: must be a list [ ... ] of facts")
        return
    question_ids = {q.get("id") for q in questions if isinstance(q, dict)}
    ids = set()
    for i, fact in enumerate(facts):
        where = f"savais-tu.json, fact {i + 1}"
        if not isinstance(fact, dict) or not text(fact.get("id")):
            problems.append(f"{where}: needs an \"id\"")
            continue
        where = f"savais-tu.json, {fact['id']}"
        if fact["id"] in ids:
            problems.append(f"{where}: this id is used twice")
        ids.add(fact["id"])
        if fact.get("theme") not in theme_ids:
            problems.append(f"{where}: unknown theme « {fact.get('theme')} » (see themes.json)")
        if not text(fact.get("text")):
            problems.append(f"{where}: needs a \"text\"")
        elif len(fact["text"]) > FACT_MAX:
            problems.append(f"{where}: \"text\" has {len(fact['text'])} characters, {FACT_MAX} at most")
        if "question" in fact and fact["question"] not in question_ids:
            problems.append(f"{where}: unknown question « {fact['question']} » (see questions.json)")
    print(f"{len(ids)} fact(s) for Accueil (savais-tu.json)")


check_planning_fixes()
check_documents(check_parcours())
check_mots()
check_facts()

if warnings:
    print(f"\n{len(warnings)} warning(s) (to look at, they do not block):")
    for w in warnings:
        print("  -", w)
if problems:
    print(f"\n{len(problems)} problem(s) (to fix before publishing):")
    for p in problems:
        print("  -", p)
    sys.exit(1)
print("\nOK: no problem found.")
