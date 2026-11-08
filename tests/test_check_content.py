"""
Tests of scripts/check_content.py: it is run on small made-up content folders, and on
the real content/. No browser needed.
Usage: python3 tests/test_check_content.py
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "check_content.py"
results = []


def run(themes, questions):
    """Writes a content folder, runs the checker on it, returns (exit code, output)."""
    with tempfile.TemporaryDirectory() as folder:
        Path(folder, "themes.json").write_text(json.dumps(themes, ensure_ascii=False), encoding="utf-8")
        Path(folder, "questions.json").write_text(json.dumps(questions, ensure_ascii=False), encoding="utf-8")
        done = subprocess.run([sys.executable, str(SCRIPT), folder], capture_output=True, text=True)
        return done.returncode, done.stdout + done.stderr


def qcm(qid, lesson=1, theme="t", status="verifie"):
    return {"id": qid, "theme": theme, "lesson": lesson, "type": "qcm", "question": f"Question {qid} ?",
            "choices": ["Un", "Deux", "Trois", "Quatre"], "correct": [0], "hint": "Un indice.",
            "explanation": "Une explication.", "source": "Cours", "status": status}


def saisie(qid, answers, hint, lesson=1, explanation="Une explication."):
    return {"id": qid, "theme": "t", "lesson": lesson, "type": "saisie", "question": f"Question {qid} ?",
            "answers": answers, "hint": hint, "explanation": explanation, "source": "Cours", "status": "verifie"}


THEMES = [{"id": "t", "title": "Un thème"}]


def check(name, ok, output=""):
    results.append((name, ok))
    if not ok:
        print(f"--- output of « {name} » ---\n{output}")


# The real content passes.
done = subprocess.run([sys.executable, str(SCRIPT)], capture_output=True, text=True)
check("real content: no problem", done.returncode == 0, done.stdout)

# A clean little file passes.
code, out = run(THEMES, [qcm("a-1"), qcm("a-2", lesson=2)])
check("clean file passes", code == 0 and "OK: no problem found." in out, out)

# Lesson numbers: start at 1, no gap.
code, out = run(THEMES, [qcm("a-1"), qcm("a-3", lesson=3)])
check("gap in lessons is a problem", code == 1 and "missing: 2" in out, out)
code, out = run(THEMES, [qcm("a-2", lesson=2)])
check("lessons starting at 2 is a problem", code == 1 and "must start at 1" in out, out)

# A hint must not contain an accepted answer.
code, out = run(THEMES, [saisie("s-1", ["mitochondries", "mitochondrie"], "Les mitochondries du muscle.")])
check("hint with the answer is a problem", code == 1 and "the hint contains the accepted answer" in out, out)
code, out = run(THEMES, [saisie("s-1", ["mitochondrie"], "Pense aux Mitochondries !")])
check("hint with the plural of the answer is a problem", code == 1 and "hint contains" in out, out)
code, out = run(THEMES, [saisie("s-1", ["SDJES"], "Le service S.D.J.E.S. du département.")])
check("hint with the answer in dotted letters is a problem", code == 1 and "hint contains" in out, out)
code, out = run(THEMES, [saisie("s-1", ["un verbe"], "« Découverte » ne va pas, « découvrir » oui.")])
check("a fair hint passes", code == 0, out)
code, out = run(THEMES, [saisie("s-1", ["test"], "Comme un contest.")])
check("a word inside another word is not the answer", code == 0, out)

# Lesson titles: a title without questions is only a warning; a broken title is a problem.
themes = [{"id": "t", "title": "Un thème", "lessons": [{"n": 1, "title": "Première"}, {"n": 2, "title": "Pas encore"}]}]
code, out = run(themes, [qcm("a-1")])
check("title without questions is a warning only", code == 0 and "has a title but no question yet" in out, out)
themes = [{"id": "t", "title": "Un thème", "lessons": [{"n": "un", "title": "Première"}]}]
code, out = run(themes, [qcm("a-1")])
check("broken lesson title is a problem", code == 1 and "each lesson title needs" in out, out)

# A wrong answer one letter away from the right one is reported (a warning).
code, out = run(THEMES, [saisie("s-1", ["ostéoblastes"], "Un mot grec.",
                                explanation="Les ostéoblastes construisent, les ostéoclastes détruisent.")])
check("typo collision is a warning", code == 0 and "« ostéoclastes » would be accepted" in out, out)

# Statuses.
code, out = run(THEMES, [qcm("a-1", status="publie")])
check("unknown status is a problem", code == 1 and "\"status\" must be" in out, out)
code, out = run(THEMES, [qcm("a-1", status="brouillon")] * 1 + [qcm("a-2", status="verifie")])
check("summary says hidden until a lesson has 5 questions", code == 0 and "hidden from the class until it has 5 questions" in out, out)

print("\n".join(f"{'PASS' if ok else 'FAIL'}  {name}" for name, ok in results))
passed = sum(ok for _, ok in results)
print(f"\n{passed}/{len(results)} checks passed")
sys.exit(0 if passed == len(results) else 1)
