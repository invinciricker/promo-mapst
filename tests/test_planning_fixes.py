"""
Tests of the planning corrections (content/planning-fixes.json) in scripts/export_planning.py.
No browser and no private repository needed.

    python3 tests/test_planning_fixes.py

  1. apply_fixes() on a tiny made-up planning: only the matching half-days of the dates
     change; the stage, the note and the category follow; applying twice changes nothing.
  2. load_fixes() refuses a malformed file (and says why).
  3. The real files: content/planning.json already has every correction, so applying them
     again changes nothing (a rebuild never undoes them).
  4. If the git history is there: the planning as it was before Claude chat's correction
     of 7 Nov 2026 (commit 843f12e), once corrected by the script, is exactly the
     content/planning.json of today.
  5. scripts/check_content.py checks the format of planning-fixes.json too.
"""
import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("export_planning", ROOT / "scripts" / "export_planning.py")
exp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exp)
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok)))
    if not ok and detail:
        print(f"--- {name} ---\n{detail}")


# ---------------------------------------------------------------------------------- 1.
def slot(half, planning, title, place="Centre de loisirs"):
    return {"half": half, "start": "09:00", "end": "12:00", "cat": "centre", "short": planning,
            "title": title, "planning": planning, "place": place, "who": "Ville de Nice"}


SMALL = {
    "source": {"corrections": "2026-11-04", "exported": "2026-11-06"},
    "categories": [{"id": "centre", "name": "Olivier", "label": "Centre de loisirs", "desc": "Avant"}],
    "stages": [{"start": "2026-11-02", "end": "2026-11-06", "title": "MSP 1 · Ville de Nice", "text": "Avant", "cat": "centre"}],
    "checks": [{"title": "Mercredi 4 novembre", "text": "Férié.", "date": "2026-11-04"}, {"title": "Sans date", "text": "Note."}],
    "days": {
        "2026-10-30": {"slots": [slot("am", "MSP 1", "MSP 1 au centre de loisirs")]},     # before: untouched
        "2026-11-02": {"slots": [slot("am", "MSP 1", "MSP 1 au centre de loisirs"), slot("pm", "MSP", "Centre de loisirs")]},
        "2026-11-03": {"slots": [slot("am", "MSP 1", "MSP 1 au centre de loisirs")]},
        "2026-11-09": {"slots": [slot("am", "MSP 1", "MSP 1 au centre de loisirs")]},     # after: untouched
    },
}
FIX = {
    "id": "test", "added": "2026-11-07", "from": "2026-11-02", "to": "2026-11-06",
    "match": {"planning": "MSP 1"},
    "set": {"title": "Stage APEC", "place": "Structures"},
    "stage": {"title": "Stage APEC", "text": "Après"},
    "check": {"title": "Du 2 au 6 novembre", "text": "Stage APEC.", "date": "2026-11-02"},
    "category": {"id": "centre", "label": "Ville de Nice", "desc": "Après"},
}
data = copy.deepcopy(SMALL)
report = exp.apply_fixes(data, [FIX])
days = data["days"]
check("only the matching half-days of the dates change",
      days["2026-11-02"]["slots"][0]["title"] == "Stage APEC" and days["2026-11-03"]["slots"][0]["place"] == "Structures"
      and days["2026-11-02"]["slots"][1]["title"] == "Centre de loisirs"
      and days["2026-10-30"]["slots"][0]["title"] == "MSP 1 au centre de loisirs"
      and days["2026-11-09"]["slots"][0]["title"] == "MSP 1 au centre de loisirs", json.dumps(days, ensure_ascii=False))
check("the official wording stays (so the correction can be found again)", days["2026-11-02"]["slots"][0]["planning"] == "MSP 1")
check("the report counts the corrected half-days", report == ["test: 2 half-day(s) corrected from 2026-11-02 to 2026-11-06"], report)
check("the stage that starts on « from » is renamed", data["stages"][0]["title"] == "Stage APEC" and data["stages"][0]["text"] == "Après")
check("the category gets its new label", data["categories"][0]["label"] == "Ville de Nice" and data["categories"][0]["desc"] == "Après")
check("the date of the corrections follows", data["source"]["corrections"] == "2026-11-07")
check("the note is added, dated notes first in date order",
      [c["title"] for c in data["checks"]] == ["Du 2 au 6 novembre", "Mercredi 4 novembre", "Sans date"], data["checks"])
again = copy.deepcopy(data)
exp.apply_fixes(again, [FIX])
check("applying twice changes nothing (no second note...)", again == data)
older = copy.deepcopy(SMALL)
older["source"]["corrections"] = "2026-12-01"
exp.apply_fixes(older, [FIX])
check("a later date of corrections is kept", older["source"]["corrections"] == "2026-12-01")
nothing = copy.deepcopy(SMALL)
report = exp.apply_fixes(nothing, [dict(FIX, match={"planning": "Inconnu"})])
check("a correction that matches nothing is reported", "WARNING" in report[0], report)

# ---------------------------------------------------------------------------------- 2.
def load_fails(doc):
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder, "planning-fixes.json")
        path.write_text(json.dumps(doc, ensure_ascii=False) if not isinstance(doc, str) else doc, encoding="utf-8")
        try:
            exp.load_fixes(path)
        except SystemExit as stop:
            return str(stop)
    return ""


check("load_fixes: a good file loads", load_fails({"about": "x", "fixes": [FIX]}) == "")
check("load_fixes: « from » after « to » is refused", "is after" in load_fails({"fixes": [dict(FIX, to="2026-11-01")]}))
check("load_fixes: an empty « match » is refused", "match" in load_fails({"fixes": [dict(FIX, match={})]}))
check("load_fixes: two corrections with the same id are refused", "id" in load_fails({"fixes": [FIX, FIX]}))
check("load_fixes: broken JSON is refused", "not valid JSON" in load_fails("{ oops"))

# ---------------------------------------------------------------------------------- 3.
fixes = exp.load_fixes()
current = json.loads((ROOT / "content" / "planning.json").read_text(encoding="utf-8"))
check("real files: planning-fixes.json has at least one correction", len(fixes) >= 1)
copied = copy.deepcopy(current)
exp.apply_fixes(copied, fixes)
check("real files: planning.json already has every correction (applying again changes nothing)", copied == current)

# ---------------------------------------------------------------------------------- 4.
before = subprocess.run(["git", "show", "843f12e:content/planning.json"], cwd=ROOT, capture_output=True, text=True)
if before.returncode == 0:
    old = json.loads(before.stdout)
    exp.apply_fixes(old, fixes)
    check("history: the planning before 7 Nov, corrected by the script, is today's planning.json", old == current,
          "\n".join(k for k in current if current[k] != old.get(k)))
else:
    print("SKIP  history: commit 843f12e is not in this copy of the repository (shallow clone)")

# ---------------------------------------------------------------------------------- 5.
def run_checker(fixes_doc):
    with tempfile.TemporaryDirectory() as folder:
        for name in ("themes.json", "questions.json", "planning.json"):
            Path(folder, name).write_text((ROOT / "content" / name).read_text(encoding="utf-8"), encoding="utf-8")
        Path(folder, "planning-fixes.json").write_text(json.dumps(fixes_doc, ensure_ascii=False), encoding="utf-8")
        done = subprocess.run([sys.executable, str(ROOT / "scripts" / "check_content.py"), folder], capture_output=True, text=True)
        return done.returncode, done.stdout


real = json.loads((ROOT / "content" / "planning-fixes.json").read_text(encoding="utf-8"))
code, out = run_checker(real)
check("check_content: the real corrections pass", code == 0 and "1 correction(s)" in out, out)
broken = copy.deepcopy(real)
broken["fixes"][0]["to"] = "2026-10-01"
code, out = run_checker(broken)
check("check_content: « from » after « to » is a problem", code == 1 and "is after" in out, out)
pending = copy.deepcopy(real)
pending["fixes"][0]["set"] = dict(pending["fixes"][0]["set"], title="Un autre titre")
code, out = run_checker(pending)
check("check_content: a correction not applied yet is a warning", code == 0 and "not applied to planning.json yet" in out, out)

print("\n".join(f"{'PASS' if ok else 'FAIL'}  {name}" for name, ok in results))
passed = sum(ok for _, ok in results)
print(f"\n{passed}/{len(results)} checks passed")
sys.exit(0 if passed == len(results) else 1)
