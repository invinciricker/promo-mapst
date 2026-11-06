"""
End-to-end test of the Réviser tab of Promo MAPST, in a phone-sized Chrome.
Usage: python3 -I test_reviser.py <repo dir> <screenshots dir>
"""
import json
import re
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO = Path(sys.argv[1])
SHOTS = Path(sys.argv[2])
SHOTS.mkdir(parents=True, exist_ok=True)
PORT = 8765
BASE = f"http://localhost:{PORT}/"

questions = json.loads((REPO / "content/questions.json").read_text(encoding="utf-8"))


def norm(text):
    text = text.replace(" ", " ").replace("[EXEMPLE]", "")
    return re.sub(r"\s+", " ", text).strip()


KEY = {norm(q["question"])[:40]: q for q in questions}
errors = []
results = []


def find_question(page):
    text = norm(page.locator(".q-text").inner_text())
    q = KEY.get(text[:40])
    assert q, f"unknown question on screen: {text!r}"
    return q


def answer(page, right=True, typo=False, mismatch=False):
    """Answers the question on screen, right or wrong. Returns the question."""
    q = find_question(page)
    if q["type"] == "qcm":
        indexes = q["correct"] if right else [i for i in range(len(q["choices"])) if i not in q["correct"]][:1]
        for i in indexes:
            page.locator(f'[data-choice="{i}"]').click()
        page.locator("[data-main]").click()
    elif q["type"] == "saisie":
        if right:
            value = q["answers"][0]
            if typo and len(value) >= 8:
                value = value[:4] + "x" + value[5:]     # one letter changed
        else:
            value = "réponse fausse"
        page.locator("[data-typed]").fill(value)
        page.locator("[data-main]").click()
    else:
        n = len(q["pairs"])
        if mismatch or not right:
            page.locator('[data-side="0"][data-pair="0"]').click()
            page.locator('[data-side="1"][data-pair="1"]').click()
            page.wait_for_timeout(700)
        for i in range(n):
            page.locator(f'[data-side="0"][data-pair="{i}"]').click()
            page.locator(f'[data-side="1"][data-pair="{i}"]').click()
        page.wait_for_timeout(500)
    page.wait_for_selector(".player__bottom.has-feedback")
    return q


def cont(page):
    page.locator("[data-main]").click()
    page.wait_for_timeout(350)


server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=REPO,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])

        def phone(scheme="light"):
            ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                      is_mobile=True, has_touch=True, color_scheme=scheme,
                                      service_workers="block", locale="fr-FR")
            page = ctx.new_page()
            page.on("console", lambda m: errors.append(f"[{scheme}] console {m.type}: {m.text}") if m.type in ("error", "warning") else None)
            page.on("pageerror", lambda e: errors.append(f"[{scheme}] page error: {e}"))
            return ctx, page

        # ---------------------------------------------------------------- light, phone
        ctx, page = phone("light")
        page.goto(BASE + "#reviser")
        page.wait_for_selector(".rv-hero")
        page.wait_for_timeout(600)
        page.screenshot(path=SHOTS / "01-home-light.png", full_page=True)
        results.append(("home renders", page.locator(".rv-theme").count() == 6))
        results.append(("examples note shown", page.locator(".note-box").count() >= 1))

        # Start « Commencer » from the home: first lesson of the first theme
        page.locator(".rv-hero [data-start]").click()
        page.wait_for_selector(".player.is-open")
        page.wait_for_timeout(450)
        page.screenshot(path=SHOTS / "02-question.png")
        lives = page.locator(".player__lives b").inner_text()
        results.append(("starts with 3 lives", lives == "3"))

        # First question: wrong on purpose
        q1 = answer(page, right=False)
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "03-wrong-feedback.png")
        results.append(("wrong answer costs a life", page.locator(".player__lives b").inner_text() == "2"))
        results.append(("question will come back", page.locator(".feedback__again").count() == 1))
        cont(page)

        # The rest: right (the wrong one comes back at the end)
        seen = [q1["id"]]
        for _ in range(6):
            if page.locator(".player-end").count():
                break
            q = find_question(page)
            if q["type"] == "saisie":
                answer(page, right=True, typo=True)
                page.wait_for_timeout(300)
                page.screenshot(path=SHOTS / "04-typo-accepted.png")
                results.append(("typo accepted with spelling tip", "orthographe" in page.locator(".feedback__note").inner_text()))
            else:
                answer(page, right=True)
                if len(seen) == 1:
                    page.wait_for_timeout(300)
                    page.screenshot(path=SHOTS / "05-right-feedback.png")
            seen.append(q["id"])
            cont(page)
        page.wait_for_selector(".player-end")
        page.wait_for_timeout(900)
        page.screenshot(path=SHOTS / "06-lesson-done.png")
        results.append(("wrong question came back at the end", seen.count(q1["id"]) == 2))
        results.append(("end screen shows XP", "+" in page.locator(".end-stat--xp b").inner_text()))
        results.append(("série started", page.locator(".end-stat--streak b").inner_text() == "1"))
        page.locator(".player__actions [data-close]").click()
        page.wait_for_timeout(700)
        results.append(("lands on the theme page", page.locator(".rv-themehead").count() == 1 and "#reviser/anatomie-mouvement" in page.url))
        page.screenshot(path=SHOTS / "07-theme-after.png", full_page=True)

        # Back to the list, then « Mes erreurs »
        page.locator("[data-back]").click()
        page.wait_for_timeout(500)
        results.append(("back goes to the list", page.locator(".rv-hero").count() == 1))
        due_text = page.locator(".rv-errors__title").inner_text()
        results.append(("one question to review", due_text.startswith("1 question")))
        page.screenshot(path=SHOTS / "08-home-after.png", full_page=True)
        page.locator("[data-review]").click()
        page.wait_for_selector(".player.is-open")
        page.wait_for_timeout(400)
        results.append(("review has no lives", page.locator(".player__lives").count() == 0))
        answer(page, right=True)
        cont(page)
        page.wait_for_selector(".player-end")
        page.wait_for_timeout(500)
        page.screenshot(path=SHOTS / "09-review-done.png")
        page.locator(".player__actions [data-close]").click()
        page.wait_for_timeout(600)
        results.append(("nothing left to review today", "Rien à revoir" in page.locator(".rv-errors__title").inner_text()))

        # Lose all the lives in another theme (opened like from the planning)
        page.goto(BASE + "#reviser/filieres-energetiques")
        page.wait_for_selector(".rv-themehead")
        page.locator(".rv-themehead [data-start]").click()
        page.wait_for_selector(".player.is-open")
        page.wait_for_timeout(400)
        for i in range(3):
            q = answer(page, right=False)
            if i == 0 and q["type"] == "saisie":
                pass
            cont(page)
        page.wait_for_selector(".player-end--lost")
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "10-lost.png")
        results.append(("lost screen after 3 mistakes", True))
        page.locator("[data-restart]").click()
        page.wait_for_timeout(400)
        results.append(("restart gives 3 lives again", page.locator(".player__lives b").inner_text() == "3"))

        # Hint on a typed answer
        for _ in range(4):
            q = find_question(page)
            if q["type"] == "saisie":
                page.locator("[data-hint]").click()
                page.wait_for_timeout(300)
                page.screenshot(path=SHOTS / "11-hint.png")
                results.append(("hint shown", page.locator(".hint-box").is_visible()))
                answer(page, right=True)        # at least one answer, so leaving asks first
                break
            answer(page, right=True)
            cont(page)

        # Leaving in the middle asks first
        page.locator(".player__close").click()
        page.wait_for_selector(".sheet-layer.is-open")
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "12-leave-sheet.png")
        page.locator("[data-leave]").click()
        page.wait_for_timeout(800)
        results.append(("player closed after leaving", page.locator(".player").count() == 0))

        # Associer, with one mismatch
        page.goto(BASE + "#reviser/publics")
        page.wait_for_selector(".rv-themehead")
        page.locator(".rv-themehead [data-start]").click()
        page.wait_for_selector(".player.is-open")
        page.wait_for_timeout(400)
        for _ in range(4):
            q = find_question(page)
            if q["type"] == "paires":
                page.locator('[data-side="0"][data-pair="0"]').click()
                page.locator('[data-side="1"][data-pair="0"]').click()
                page.locator('[data-side="0"][data-pair="1"]').click()
                page.wait_for_timeout(300)
                page.screenshot(path=SHOTS / "13-pairs.png")
                page.locator('[data-side="1"][data-pair="2"]').click()
                page.wait_for_timeout(150)
                page.screenshot(path=SHOTS / "14-pairs-miss.png")
                page.wait_for_timeout(600)
                for i in range(1, len(q["pairs"])):
                    page.locator(f'[data-side="0"][data-pair="{i}"]').click()
                    page.locator(f'[data-side="1"][data-pair="{i}"]').click()
                page.wait_for_selector(".player__bottom.has-feedback")
                page.wait_for_timeout(400)
                page.screenshot(path=SHOTS / "15-pairs-feedback.png")
                results.append(("pairs with a mismatch count as a mistake", page.locator(".player__bottom.is-wrong").count() == 1))
                break
            answer(page, right=True)
            cont(page)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
        if page.locator("[data-leave]").count():
            page.locator("[data-leave]").click()
            page.wait_for_timeout(700)

        # What is saved
        saved = page.evaluate("JSON.parse(localStorage.getItem('promo-mapst:reviser'))")
        results.append(("progress saved", saved["xp"] > 0 and "anatomie-mouvement:1" in saved["lessons"]))
        results.append(("mistakes saved", len(saved["cards"]) >= 3))

        # Infos: reset button, two taps
        page.goto(BASE + "#infos")
        page.wait_for_selector("[data-reset-reviser]")
        page.locator("[data-reset-reviser]").scroll_into_view_if_needed()
        page.screenshot(path=SHOTS / "16-infos.png", full_page=True)
        page.locator("[data-reset-reviser]").click()
        armed = "Touche encore" in page.locator("[data-reset-reviser]").inner_text()
        page.locator("[data-reset-reviser]").click()
        page.wait_for_timeout(300)
        results.append(("reset needs two taps and erases", armed and page.evaluate("localStorage.getItem('promo-mapst:reviser')") is None))
        ctx.close()

        # ---------------------------------------------------------------- dark, phone
        ctx, page = phone("dark")
        page.goto(BASE + "#reviser")
        page.wait_for_selector(".rv-hero")
        page.wait_for_timeout(600)
        page.screenshot(path=SHOTS / "17-home-dark.png", full_page=True)
        page.locator(".rv-hero [data-start]").click()
        page.wait_for_selector(".player.is-open")
        page.wait_for_timeout(400)
        q = find_question(page)
        if q["type"] == "qcm" and len(q["correct"]) > 1:
            page.locator(f'[data-choice="{q["correct"][0]}"]').click()
            page.screenshot(path=SHOTS / "18-multi-selected-dark.png")
        answer_q = answer(page, right=False)
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "19-wrong-dark.png")
        cont(page)
        answer(page, right=True)
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "20-right-dark.png")
        ctx.close()

        # ---------------------------------------------------------------- laptop
        ctx = browser.new_context(viewport={"width": 1280, "height": 800}, color_scheme="light", service_workers="block")
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(f"[laptop] page error: {e}"))
        page.goto(BASE + "#reviser")
        page.wait_for_selector(".rv-hero")
        page.wait_for_timeout(600)
        page.screenshot(path=SHOTS / "21-laptop-home.png")
        page.goto(BASE + "#reviser/fiche-de-seance")
        page.wait_for_selector(".rv-themehead")
        page.wait_for_timeout(500)
        page.screenshot(path=SHOTS / "22-laptop-theme.png")
        page.locator(".rv-themehead [data-start]").click()
        page.wait_for_selector(".player.is-open")
        page.wait_for_timeout(500)
        # keyboard: digits choose, Enter checks
        q = find_question(page)
        if q["type"] == "qcm":
            page.keyboard.press("1")
            page.keyboard.press("Enter")
            page.wait_for_selector(".player__bottom.has-feedback")
            results.append(("keyboard: 1 then Enter checks", True))
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "23-laptop-player.png")
        ctx.close()

        # ---------------------------------------------------------------- planning still fine
        ctx, page = phone("light")
        page.goto(BASE + "#planning")
        page.wait_for_selector(".now", timeout=8000)
        page.wait_for_timeout(500)
        results.append(("planning still loads", page.locator(".now").count() == 1))
        page.goto(BASE + "#etudier")
        page.wait_for_timeout(500)
        results.append(("étudier still says bientôt", "Bientôt" in page.locator("#screen-etudier").inner_text()))
        ctx.close()
        browser.close()
finally:
    server.terminate()

print("\n".join(f"{'PASS' if ok else 'FAIL'}  {name}" for name, ok in results))
print(f"\n{sum(ok for _, ok in results)}/{len(results)} checks passed")
print("\nConsole / page errors:" if errors else "\nNo console or page errors.")
for e in errors:
    print("  ", e)
