"""
Test of the real account code (js/compte/backend.js, the Firebase SDK in vendor/firebase/)
against the real database rules (docs/firebase/firestore.rules), on Firebase's emulators:
a pretend Firebase that runs on this computer. Nothing is sent to the real project.

It checks that what the app writes is exactly what the rules accept:
  - creating an account (a wrong class code is refused and the sign-in account deleted,
    a pseudo already taken, the right class code), the classement line of the week;
  - the sync of the progress after a lesson;
  - the caps of the classement (3 000 on the first line, then +400 at least 10 s later);
  - the questions: asking, « Moi aussi », the admin's answer and delete;
  - changing the code, signing out and in, deleting the account (everything goes).

    python3 tests/test_rules.py [<repo folder>]

Needs, besides Python Playwright: Java 11 or later, and the Firebase command line
(npm install -g firebase-tools, or set FIREBASE_CLI to its path). Without them it says
SKIP and stops (exit 0). It takes about two minutes.
"""
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

REPO = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
PROJECT = "demo-promo"
NBSP = " "
VISIBLE = ".panel.is-on .page:not([hidden])"
SHEET = ".sheet-layer.is-open .sheet"


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


cli = os.environ.get("FIREBASE_CLI") or shutil.which("firebase")
if not cli or not shutil.which("java"):
    print("SKIP  tests/test_rules.py needs Java and the Firebase command line (firebase-tools).")
    sys.exit(0)

from playwright.sync_api import sync_playwright   # noqa: E402

results = []
errors = []


def check(name, ok):
    results.append((name, bool(ok)))
    if not ok:
        print(f"FAIL  {name}", flush=True)


def norm(text):
    return re.sub(r"\s+", " ", (text or "").replace(NBSP, " ").replace("’", "'")).strip()


AUTH, FIRESTORE, HUB, WEB = free_port(), free_port(), free_port(), free_port()
work = Path(tempfile.mkdtemp(prefix="promo-mapst-rules-"))
(work / "firebase.json").write_text(json.dumps({
    "firestore": {"rules": str(REPO / "docs/firebase/firestore.rules")},
    "emulators": {"auth": {"host": "127.0.0.1", "port": AUTH}, "firestore": {"host": "127.0.0.1", "port": FIRESTORE},
                  "hub": {"host": "127.0.0.1", "port": HUB}, "ui": {"enabled": False}, "logging": {"host": "127.0.0.1", "port": free_port()},
                  "singleProjectMode": True},
}))
log = open(work / "emulators.log", "w")
emulators = subprocess.Popen([cli, "emulators:start", "--only", "auth,firestore", "--project", PROJECT], cwd=work,
                             stdout=log, stderr=subprocess.STDOUT)
web = subprocess.Popen([sys.executable, "-m", "http.server", str(WEB), "--bind", "127.0.0.1"], cwd=REPO,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

DOCS = f"http://127.0.0.1:{FIRESTORE}/v1/projects/{PROJECT}/databases/(default)/documents"


def rest(method, url, body=None):
    """The emulator's REST API, as the owner (the rules don't apply): to prepare and to look."""
    request = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={"Authorization": "Bearer owner", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise


def value(v):
    """A Firestore REST value -> Python."""
    if "stringValue" in v: return v["stringValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "booleanValue" in v: return v["booleanValue"]
    if "timestampValue" in v: return v["timestampValue"]
    if "arrayValue" in v: return [value(x) for x in v["arrayValue"].get("values", [])]
    if "nullValue" in v: return None
    return v


def doc(path):
    d = rest("GET", f"{DOCS}/{path}")
    return {k: value(v) for k, v in d.get("fields", {}).items()} if d else None


def collection(name):
    d = rest("GET", f"{DOCS}/{name}?pageSize=300") or {}
    return {x["name"].split("/")[-1]: {k: value(v) for k, v in x.get("fields", {}).items()} for x in d.get("documents", [])}


try:
    for _ in range(90):
        time.sleep(1)
        if "All emulators ready" in (work / "emulators.log").read_text(errors="ignore"):
            break
    else:
        print((work / "emulators.log").read_text(errors="ignore")[-2000:])
        raise SystemExit("The emulators did not start.")
    # What the owner creates by hand in the console: the class code and the admin.
    rest("POST", f"{DOCS}/codes?documentId=mapst-test", {"fields": {"actif": {"booleanValue": True}}})
    rest("POST", f"{DOCS}/admins?documentId=prof", {"fields": {"depuis": {"stringValue": "2026-11-13"}}})
    BASE = f"http://127.0.0.1:{WEB}/?backend=emulateur&projet={PROJECT}&auth={AUTH}&firestore={FIRESTORE}"

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None)

        def phone(label, storage=None):
            ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True,
                                      service_workers="block", locale="fr-FR", timezone_id="Europe/Paris")
            setup = {"promo-mapst:bienvenue": "true", "promo-mapst:prenom": json.dumps("Sam")}
            setup.update(storage or {})
            ctx.add_init_script("if (!localStorage.getItem('test-seeded')) {" + "".join(
                f"localStorage.setItem({json.dumps(k)}, {json.dumps(v)});" for k, v in setup.items())
                + "localStorage.setItem('test-seeded', '1'); }")
            page = ctx.new_page()

            def on_console(m):
                # The refusals this test asks for (wrong code, pseudo taken...) are logged by
                # the browser as « Failed to load resource: 400/403 »: expected, not errors.
                if m.type == "error" and not re.match(r"Failed to load resource: the server responded with a status of 4\d\d", m.text):
                    errors.append(f"[{label}] console: {m.text}")
            page.on("console", on_console)
            page.on("pageerror", lambda e: errors.append(f"[{label}] page error: {e}"))
            return ctx, page

        def go(page, hash_):
            page.goto(f"{BASE}&n={time.time_ns()}{hash_}")
            page.wait_for_selector(VISIBLE)
            page.wait_for_timeout(600)

        def sheet(page, mode):
            page.locator(f"{VISIBLE} [data-compte='{mode}']").first.click()
            page.wait_for_selector(SHEET)
            page.wait_for_timeout(400)

        def fill(page, **fields):
            for name, v in fields.items():
                page.locator(f"{SHEET} [name='{name}']").fill(v)

        def submit(page, wait=2500):
            page.locator(f"{SHEET} [type=submit]").click()
            page.wait_for_timeout(wait)

        def err(page, name):
            box = page.locator(f"{SHEET} [data-err='{name}']")
            return norm(box.inner_text()) if box.count() else ""

        def today():
            return page.evaluate("(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })()")

        def week():
            return page.evaluate("import('./js/compte/regles.js').then((r) => r.semaineISO(new Date()))")

        # ---- 1. Creating Sam's account: a wrong class code, then the right one
        ctx, page = phone("sam")
        go(page, "#accueil/profil")
        day = today()
        page.evaluate(f"""localStorage.setItem('promo-mapst:reviser', JSON.stringify({{ v: 1, xp: 160, days: {{ '{day}': {{ xp: 160, done: 2 }} }},
            done: {{}}, cards: {{}}, runs: {{}}, lastTheme: null }}))""")
        go(page, "#accueil/profil")
        sheet(page, "creer")
        fill(page, pseudo="Sam", code="481930", code2="481930", promo="mauvais-code")
        submit(page)
        check("rules: a wrong class code is refused (create of membres)",
              err(page, "promo") == "Ce code de la promo n'est pas bon. Demande-le à ton groupe." and doc("membres/sam") is None)
        fill(page, promo="mapst-test")
        page.locator(f"{SHEET} [name='classement']").check()
        submit(page, wait=3500)
        check("rules: … the sign-in account was deleted, so the same pseudo can be created right after",
              page.locator(SHEET).count() == 0 and doc("membres/sam") is not None)
        m = doc("membres/sam") or {}
        check("rules: the profile has pseudo, code, creeLe, progres, majLe", sorted(m) == ["code", "creeLe", "majLe", "progres", "pseudo"]
              and m.get("pseudo") == "Sam" and m.get("code") == "mapst-test" and json.loads(m.get("progres", "{}"))["reviser"]["xp"] == 160)
        line = doc("classement/sam") or {}
        check("rules: the classement line of the week is accepted", line.get("xp") == 160 and line.get("semaine") == week())

        # ---- 2. The sync after a lesson
        page.evaluate("""async () => {
          const s = await import('./js/core/storage.js');
          s.save('lecons', { 'fiche-de-seance-les-bases': { at: 0, read: '2026-11-13' } });
          window.dispatchEvent(new CustomEvent('progres-fini'));
        }""")
        page.wait_for_timeout(16500)       # 5 s after, and never sooner than 15 s after the last write
        online = json.loads((doc("membres/sam") or {}).get("progres", "{}"))
        check("rules: the progress is updated after a lesson (update of membres)", "fiche-de-seance-les-bases" in online.get("lecons", {}))

        # ---- 3. Sam asks a question
        go(page, "#cours/fiche-de-seance")
        page.locator(f"{VISIBLE} .chapter__ask [data-poser]").click()
        page.wait_for_selector(SHEET)
        page.locator(f"{SHEET} textarea").fill("C'est quoi un objectif opérationnel ?")
        submit(page)
        questions = collection("questions")
        mine = [q for q in questions.values() if q.get("auteur") == "sam"]
        check("rules: a question is accepted (create of questions)", len(mine) == 1 and mine[0]["chapitre"] == "fiche-de-seance"
              and mine[0]["reponse"] == "" and mine[0]["aussi"] == [] and mine[0]["pseudo"] == "Sam")

        # ---- 4. Another person: the pseudo taken, then Lea, « Moi aussi »
        ctx2, page2 = phone("lea")
        go(page2, "#accueil/profil")
        sheet(page2, "creer")
        fill(page2, pseudo="sam", code="839201", code2="839201", promo="mapst-test")
        submit(page2)
        check("rules: a pseudo already taken (whatever the capitals)", err(page2, "pseudo") == "Ce pseudo est déjà pris. Si c'est le tien, connecte-toi.")
        fill(page2, pseudo="Lea")
        submit(page2, wait=3500)
        check("rules: Lea's account", doc("membres/lea") is not None)
        go(page2, "#cours/questions")
        page2.wait_for_timeout(1500)
        check("rules: a member reads the questions (list with orderBy and limit)", page2.locator(f"{VISIBLE} .qcard").count() == 1)
        page2.locator(f"{VISIBLE} .qcard").first.click()
        page2.wait_for_selector(SHEET)
        page2.wait_for_timeout(500)
        page2.locator(f"{SHEET} [data-aussi]").click()
        page2.wait_for_timeout(2000)
        qid = next(i for i, q in collection("questions").items() if q.get("auteur") == "sam")
        check("rules: « Moi aussi » is accepted (arrayUnion of my pseudo only)", doc(f"questions/{qid}")["aussi"] == ["lea"])
        page2.locator(f"{SHEET} [data-aussi]").click()
        page2.wait_for_timeout(2000)
        check("rules: … and off again (arrayRemove)", doc(f"questions/{qid}")["aussi"] == [])
        go(page2, "#reviser/classement")
        page2.wait_for_timeout(2000)
        check("rules: a member reads the classement", "Sam" in norm(page2.locator(f"{VISIBLE} .classement__list").inner_text()))
        ctx2.close()

        # ---- 5. The admin answers and deletes
        ctx3, page3 = phone("prof")
        go(page3, "#accueil/profil")
        sheet(page3, "creer")
        fill(page3, pseudo="Prof", code="270514", code2="270514", promo="mapst-test")
        submit(page3, wait=3500)
        go(page3, "#cours/questions")
        page3.wait_for_timeout(2000)
        check("rules: the admin is recognised (get of admins/<me>)", page3.locator(f"{VISIBLE} [data-filter='arepondre']").count() == 1)
        page3.locator(f"{VISIBLE} .qcard").first.click()
        page3.wait_for_selector(SHEET)
        page3.wait_for_timeout(800)
        page3.locator(f"{SHEET} textarea[name='reponse']").fill("Ce que le pratiquant saura faire à la fin de la séance, de façon observable.")
        page3.locator(f"{SHEET} .qsheet__admin [type=submit]").click()
        page3.wait_for_timeout(2500)
        answered = doc(f"questions/{qid}") or {}
        check("rules: the admin's answer is accepted (reponse and reponduLe)", answered.get("reponse", "").startswith("Ce que le pratiquant")
              and answered.get("reponduLe"))
        ctx3.close()

        # ---- 6. Caps of the classement, with Max (5 000 XP this week)
        ctx4, page4 = phone("max")
        go(page4, "#accueil/profil")
        page4.evaluate(f"""localStorage.setItem('promo-mapst:reviser', JSON.stringify({{ v: 1, xp: 5000, days: {{ '{day}': {{ xp: 5000, done: 30 }} }},
            done: {{}}, cards: {{}}, runs: {{}}, lastTheme: null }}))""")
        go(page4, "#accueil/profil")
        sheet(page4, "creer")
        fill(page4, pseudo="Max", code="530718", code2="530718", promo="mapst-test")
        page4.locator(f"{SHEET} [name='classement']").check()
        submit(page4, wait=3500)
        check("rules: the first line, capped at 3 000, is accepted", (doc("classement/max") or {}).get("xp") == 3000)
        page4.wait_for_timeout(17000)
        check("rules: the next one, +400 at least 10 s later, is accepted", (doc("classement/max") or {}).get("xp") == 3400)
        ctx4.close()

        # ---- 7. Sam: change the code, sign out, sign in, switch the classement off, delete
        go(page, "#accueil/profil")
        page.locator(f"{VISIBLE} [data-code]").click()
        page.wait_for_selector(SHEET)
        fill(page, ancien="000001", code="702815", code2="702815")
        submit(page)
        check("rules: a wrong current code is refused (reauthenticate)", err(page, "ancien") == "Code incorrect.")
        fill(page, ancien="481930")
        submit(page)
        check("rules: the code is changed (updatePassword)", page.locator(SHEET).count() == 0)
        page.locator(f"{VISIBLE} [data-logout]").click()
        page.wait_for_selector(SHEET)
        page.locator(f"{SHEET} [data-logout]").click()
        page.wait_for_timeout(2500)
        sheet(page, "connecter")
        fill(page, pseudo="Sam", code="481930")
        submit(page)
        check("rules: the old code no longer works", err(page, "code") == "Pseudo ou code incorrect.")
        fill(page, code="702815")
        submit(page, wait=4000)
        check("rules: signed in with the new code", page.locator(SHEET).count() == 0 and "Sam" in norm(page.locator(f"{VISIBLE} .compte-list").inner_text()))
        page.locator(f"{VISIBLE} [data-classement-switch]").uncheck()
        page.wait_for_timeout(2500)
        check("rules: switching the classement off deletes my line", doc("classement/sam") is None)
        page.locator(f"{VISIBLE} [data-delete]").click()
        page.wait_for_selector(SHEET)
        fill(page, code="702815")
        submit(page, wait=4000)
        check("rules: deleting the account: profile, line and questions go",
              doc("membres/sam") is None and doc("classement/sam") is None
              and not [q for q in collection("questions").values() if q.get("auteur") == "sam"])
        sheet(page, "connecter")
        fill(page, pseudo="Sam", code="702815")
        submit(page)
        check("rules: … and the sign-in account too", err(page, "code") == "Pseudo ou code incorrect.")
        ctx.close()
        browser.close()
except Exception:
    print("\n".join(f"{'PASS' if ok else 'FAIL'}  {name}" for name, ok in results))
    for e in errors:
        print("  ", e)
    raise
finally:
    web.terminate()
    emulators.terminate()
    try:
        emulators.wait(timeout=20)
    except subprocess.TimeoutExpired:
        emulators.kill()
    log.close()

check("no console or page errors", not errors)
print("\n".join(f"{'PASS' if ok else 'FAIL'}  {name}" for name, ok in results))
passed = sum(ok for _, ok in results)
print(f"\n{passed}/{len(results)} checks passed. Emulator log: {work / 'emulators.log'}")
for e in errors:
    print("  ", e)
sys.exit(0 if passed == len(results) else 1)
