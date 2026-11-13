"""
Test of the offline mode and of « content without code » (sw.js), in Chromium:
  - after a first visit, the app opens without internet, with Réviser and the planning;
  - a content file that no code lists (like a future study page) works offline once
    it has been opened;
  - when a content file changes on the website, the app uses it at the next opening
    (here, a theme added to content/themes.json, which also gets its colour by itself);
  - the lessons of Cours (content/lecons/, Phase 5) work offline, even one never opened,
    and a new lesson (one line in index.json and its .md file) shows up without code.

    python3 tests/test_offline.py [<repo folder>]

It copies the app to a temporary folder (to add and change files there), and serves it.
Needs Python Playwright (pip install playwright).
"""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
results = []


def check(name, ok):
    results.append((name, bool(ok)))


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


site = Path(tempfile.mkdtemp(prefix="promo-mapst-site-"))
for item in ("index.html", "manifest.webmanifest", "sw.js", "css", "js", "content", "icons", "img", "vendor"):
    source = REPO / item
    if source.is_dir():
        shutil.copytree(source, site / item)
    else:
        shutil.copy2(source, site / item)
(site / "content" / "extra-test.json").write_text('{"page": "une page ajoutée sans toucher au code"}', encoding="utf-8")

PORT = free_port()
BASE = f"http://127.0.0.1:{PORT}/"
server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=site,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None)
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="allow", locale="fr-FR")
        # Skip the welcome: a first name is already saved.
        ctx.add_init_script("localStorage.setItem('promo-mapst:bienvenue', 'true'); localStorage.setItem('promo-mapst:prenom', '\"Sam\"');")
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        VISIBLE = ".panel.is-on .page:not([hidden])"

        # First visit: sw.js installs and saves the app.
        page.goto(BASE + "#reviser")
        page.wait_for_selector(f"{VISIBLE} .gcard")
        page.evaluate("navigator.serviceWorker.ready")
        page.reload()                                     # now the page goes through sw.js
        page.wait_for_selector(f"{VISIBLE} .gcard")
        check("sw.js controls the page", page.evaluate("Boolean(navigator.serviceWorker.controller)"))
        body = page.evaluate("fetch('content/extra-test.json').then(r => r.text())")
        check("a content file not listed anywhere loads", "sans toucher au code" in body)
        page.wait_for_timeout(500)

        # Without internet.
        ctx.set_offline(True)
        page.reload()
        page.wait_for_selector(f"{VISIBLE} .gcard", timeout=15000)
        check("offline: the app opens on Réviser", page.locator(f"{VISIBLE} .tile").count() == 6)
        page.goto(BASE + "#planning")
        page.reload()
        page.wait_for_selector(f"{VISIBLE} .days", timeout=15000)
        check("offline: the planning works", page.locator(f"{VISIBLE} .dcard").count() == 7)
        page.goto(BASE + "#accueil")
        page.reload()
        page.wait_for_selector(f"{VISIBLE} .home__sky svg", timeout=15000)
        page.wait_for_timeout(500)
        check("offline: Accueil and its picture of the bay, « le mot » and « En ce moment »",
              page.locator(f"{VISIBLE} .home__sky svg .b-swell").count() >= 3
              and page.locator(f"{VISIBLE} .mot .w").count() > 2 and page.locator(f"{VISIBLE} .now__title").count() == 1)
        page.goto(BASE + "#cours")
        page.reload()
        page.wait_for_selector(f"{VISIBLE} .chap", timeout=15000)
        check("offline: Cours and its path of chapters", page.locator(f"{VISIBLE} .chap").count() >= 6)
        body = page.evaluate("fetch('content/extra-test.json').then(r => r.ok ? r.text() : 'erreur ' + r.status).catch(e => 'erreur ' + e)")
        check("offline: the unlisted content file comes from the saved copy", "sans toucher au code" in body)
        for chapter, lesson in (("filieres-energetiques", "filieres-les-trois"), ("fiche-de-seance", "fiche-de-seance-les-bases")):
            page.goto(BASE + f"#cours/{chapter}?lecon={lesson}")
            page.reload()
            page.wait_for_selector(".player--lecon .lcard__title", timeout=15000)
            check(f"offline: a lesson never opened before reads ({lesson})", page.locator(".player--lecon .lc-wait").count() == 0
                  and page.locator(".player--lecon .lecon__segs i").count() > 3)

        # Back online, the content changed on the website: used at the next opening.
        ctx.set_offline(False)
        themes = json.loads((site / "content" / "themes.json").read_text(encoding="utf-8"))
        themes.append({"id": "nouveau-theme", "title": "Un thème ajouté sans toucher au code"})
        (site / "content" / "themes.json").write_text(json.dumps(themes, ensure_ascii=False), encoding="utf-8")
        index = json.loads((site / "content" / "lecons" / "index.json").read_text(encoding="utf-8"))
        index["lecons"].append({"id": "seance-et-cycle-essai", "chapitre": "seance-et-cycle", "title": "Une leçon ajoutée sans toucher au code",
                                "minutes": 3, "source": "Test", "status": "brouillon", "added": "2026-11-13"})
        (site / "content" / "lecons" / "index.json").write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
        (site / "content" / "lecons" / "seance-et-cycle-essai.md").write_text(
            "## Une\n\nPremière carte.\n\n## Deux\n\nDeuxième carte.\n\n## Trois\n\nTroisième carte.\n", encoding="utf-8")
        page.goto(BASE + "#cours/seance-et-cycle")
        page.reload()
        page.wait_for_selector(f"{VISIBLE} .lesson-row")
        page.wait_for_timeout(300)
        check("online again: a new lesson shows up in its chapter, with no change to the code",
              "Une leçon ajoutée sans toucher au code" in page.locator(f"{VISIBLE} .lesson-row").first.inner_text())
        page.locator(f"{VISIBLE} [data-lecon='seance-et-cycle-essai']").click()
        page.wait_for_selector(".player--lecon .lcard__title")
        check("… and it opens: 3 cards and the last one", page.locator(".player--lecon .lecon__segs i").count() == 4)
        page.goto(BASE + "#reviser")
        page.reload()
        page.wait_for_selector(f"{VISIBLE} .gcard")
        page.wait_for_timeout(300)
        check("online again: new content is used straight away",
              page.locator(f"{VISIBLE} .tile").count() == 7 and "Un thème ajouté sans toucher au code" in page.locator(f"{VISIBLE} .grid").inner_text())
        check("a new theme gets the next colour, with no change to the code",
              "tone-bougainvillier" in page.locator(f"{VISIBLE} .tile").nth(6).get_attribute("class"))
        check("no page errors", not errors)
        browser.close()
finally:
    server.terminate()
    shutil.rmtree(site, ignore_errors=True)

print("\n".join(f"{'PASS' if ok else 'FAIL'}  {name}" for name, ok in results))
passed = sum(ok for _, ok in results)
print(f"\n{passed}/{len(results)} checks passed")
sys.exit(0 if passed == len(results) else 1)
