#!/usr/bin/env python3
"""
Checks the content of Réviser before you publish it:
    python3 scripts/check_content.py

It reads content/themes.json and content/questions.json and prints:
  - every problem it finds (a missing field, a wrong index, an unknown theme...), with the
    id of the question, so you can fix it;
  - a summary: how many questions and lessons each theme has.

The app itself skips a broken question instead of crashing, but it is better to fix it:
a skipped question is simply missing for everyone.
The formats are described in CLAUDE.md (« Content formats »).
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TYPES = ("qcm", "saisie", "paires")
STATUSES = ("brouillon", "verifie", "exemple")
problems = []


def load(name):
    path = ROOT / "content" / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        problems.append(f"{name}: file not found")
    except json.JSONDecodeError as error:
        problems.append(f"{name}: not valid JSON (line {error.lineno}, column {error.colno}: {error.msg})")
    return None


def text(value):
    return isinstance(value, str) and value.strip() != ""


themes = load("themes.json") or []
questions = load("questions.json") or []

theme_ids = []
for i, theme in enumerate(themes):
    if not isinstance(theme, dict) or not text(theme.get("id")) or not text(theme.get("title")):
        problems.append(f"themes.json, item {i + 1}: needs an \"id\" and a \"title\"")
        continue
    if theme["id"] in theme_ids:
        problems.append(f"themes.json: the id \"{theme['id']}\" is used twice")
    theme_ids.append(theme["id"])

seen = set()
counts = defaultdict(lambda: defaultdict(int))
types = defaultdict(int)
examples = 0

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
    if not isinstance(lesson, int) or isinstance(lesson, bool) or lesson < 1:
        problems.append(f"{where}: \"lesson\" must be a whole number (1, 2, 3...)")
    if not text(q.get("question")):
        problems.append(f"{where}: \"question\" is empty")
    for field in ("hint", "explanation", "source"):
        if field in q and not isinstance(q[field], str):
            problems.append(f"{where}: \"{field}\" must be a text")
    if not text(q.get("explanation")):
        problems.append(f"{where}: \"explanation\" is empty (one sentence is shown after each answer)")
    if q.get("status") not in STATUSES:
        problems.append(f"{where}: \"status\" must be \"brouillon\", \"verifie\" or \"exemple\"")
    if q.get("status") == "exemple":
        examples += 1
    if "study" in q and q["study"] is not None and not isinstance(q["study"], str):
        problems.append(f"{where}: \"study\" must be the id of a study page (a text)")

    kind = q.get("type")
    if kind not in TYPES:
        problems.append(f"{where}: \"type\" must be \"qcm\", \"saisie\" or \"paires\"")
    elif kind == "qcm":
        choices = q.get("choices")
        correct = q.get("correct")
        if not isinstance(choices, list) or len(choices) < 2 or not all(text(c) for c in choices):
            problems.append(f"{where}: \"choices\" needs at least 2 texts (4 is the rule)")
        elif len(choices) != 4:
            problems.append(f"{where}: {len(choices)} choices (the rule is 4)")
        if not isinstance(correct, list) or not correct:
            problems.append(f"{where}: \"correct\" needs the index of at least one right choice (0 = the first)")
        elif isinstance(choices, list):
            for index in correct:
                if not isinstance(index, int) or isinstance(index, bool) or not 0 <= index < len(choices):
                    problems.append(f"{where}: \"correct\" has {index!r}, but the choices go from 0 to {len(choices) - 1}")
            if len(set(map(str, correct))) != len(correct):
                problems.append(f"{where}: an index appears twice in \"correct\"")
    elif kind == "saisie":
        answers = q.get("answers")
        if not isinstance(answers, list) or not answers or not all(text(a) for a in answers):
            problems.append(f"{where}: \"answers\" needs at least one accepted answer (the main one first)")
        if not text(q.get("hint")):
            problems.append(f"{where}: a « Réponse à taper » needs a \"hint\" (a clue that does not give the answer)")
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

    if q.get("theme") in theme_ids and isinstance(lesson, int):
        counts[q["theme"]][lesson] += 1
    if kind in TYPES:
        types[kind] += 1

print(f"{len(questions)} questions, {len(theme_ids)} themes"
      f" ({types['qcm']} QCM, {types['saisie']} à taper, {types['paires']} à associer; {examples} exemples)")
for theme_id in theme_ids:
    lessons = counts.get(theme_id, {})
    detail = ", ".join(f"leçon {n}: {lessons[n]}" for n in sorted(lessons)) or "no question yet"
    short = [n for n in sorted(lessons) if lessons[n] < 8 or lessons[n] > 10]
    note = f"  (the rule is 8 to 10 questions per lesson: check leçon {', '.join(map(str, short))})" if short and examples < len(questions) else ""
    print(f"  {theme_id}: {detail}{note}")

if problems:
    print(f"\n{len(problems)} problem(s):")
    for p in problems:
        print("  -", p)
    sys.exit(1)
print("\nOK: no problem found.")
