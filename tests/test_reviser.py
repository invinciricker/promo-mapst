"""
End-to-end test of the Réviser tab of Promo MAPST, in a phone-sized Chromium.

    python3 tests/test_reviser.py [<repo folder>] [<screenshots folder>]

Needs Python Playwright (pip install playwright) and its Chromium. Set CHROME_PATH to use
another Chromium. It starts a small local web server, plays lessons like a person would,
and prints PASS or FAIL for each check (the exit code is 1 if one fails).

The real content/questions.json is used as it is (all "brouillon" for now: the class
sees « Questions en préparation »). To test what the class sees once questions are
checked, the test serves a copy where some questions are "verifie" (the "fixtures").
The Relecture is tested with the real file, by switching the mode on in Infos.
"""
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from playwright.sync_api import sync_playwright

REPO = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(tempfile.mkdtemp(prefix="promo-mapst-shots-"))
SHOTS.mkdir(parents=True, exist_ok=True)

REAL = json.loads((REPO / "content/questions.json").read_text(encoding="utf-8"))
BY_ID = {q["id"]: q for q in REAL}
NBSP = " "
MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]

results = []
errors = []


def check(name, ok):
    results.append((name, bool(ok)))
    if not ok:
        print(f"FAIL  {name}", flush=True)


def norm(text):
    return re.sub(r"\s+", " ", text.replace(NBSP, " ")).strip()


BY_TEXT = {norm(q["question"]): q for q in REAL}
assert len(BY_TEXT) == len(REAL), "two questions have the same text: the test can't tell them apart"


def fixture(verified, extra=(), drop=(), change=None):
    """A copy of the real questions: the first N of each id prefix become "verifie"."""
    out = []
    for q in REAL:
        if q["id"] in drop:
            continue
        q = dict(q)
        for prefix, count in verified.items():
            ids = [x["id"] for x in REAL if x["id"].startswith(prefix)][:count]
            if q["id"] in ids:
                q["status"] = "verifie"
        if change and q["id"] in change:
            q.update(change[q["id"]])
        out.append(q)
    return out + list(extra)


# ---------------------------------------------------------------------------------------
# Playing
# ---------------------------------------------------------------------------------------
def find_question(page, pool=None):
    """The question on screen: by its id in Relecture (badge), otherwise by its text."""
    badge = page.locator(".player .badge--id")
    if badge.count():
        qid = norm(badge.first.inner_text()).split("·")[-1].strip()
        return (pool or BY_ID)[qid]
    text = norm(page.locator(".q-text").inner_text())
    lookup = {norm(q["question"]): q for q in pool.values()} if pool else BY_TEXT
    assert text in lookup, f"unknown question on screen: {text!r}"
    return lookup[text]


def answer(page, right=True, typo=False, pool=None):
    """Answers the question on screen, right or wrong. Returns the question."""
    q = find_question(page, pool)
    if q["type"] == "qcm":
        indexes = q["correct"] if right else [i for i in range(len(q["choices"])) if i not in q["correct"]][:1]
        for i in indexes:
            page.locator(f'.player [data-choice="{i}"]').click()
        page.locator(".player [data-main]").click()
    elif q["type"] == "saisie":
        value = q["answers"][0]
        if not right:
            value = "réponse fausse"
        elif typo and len(value) >= 8:
            value = value[:4] + "x" + value[5:]          # one letter changed
        page.locator(".player [data-typed]").fill(value)
        page.locator(".player [data-main]").click()
    else:
        if not right:
            page.locator('.player [data-side="0"][data-pair="0"]').click()
            page.locator('.player [data-side="1"][data-pair="1"]').click()
            page.wait_for_timeout(700)
        for i in range(len(q["pairs"])):
            page.locator(f'.player [data-side="0"][data-pair="{i}"]').click()
            page.locator(f'.player [data-side="1"][data-pair="{i}"]').click()
    page.wait_for_selector(".player__bottom.has-feedback")
    return q


def cont(page):
    page.locator(".player [data-main]").click()
    page.wait_for_timeout(250)


def finish_lesson(page, pool=None, limit=30):
    """Answers right until the end screen. Returns the ids seen."""
    seen = []
    for _ in range(limit):
        if page.locator(".player-end").count():
            break
        seen.append(answer(page, right=True, pool=pool)["id"])
        cont(page)
    page.wait_for_selector(".player-end")
    return seen


def no_overflow(page):
    return page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1")


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def report_date():
    now = datetime.now(ZoneInfo("Europe/Paris"))
    day = "1er" if now.day == 1 else str(now.day)
    return f"{day} {MONTHS_SHORT[now.month - 1]} {now.year}"


PORT = free_port()
BASE = f"http://127.0.0.1:{PORT}/"
server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=REPO,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None)

        def serve(ctx, questions):
            body = json.dumps(questions, ensure_ascii=False)
            ctx.unroute("**/content/questions.json")
            ctx.route("**/content/questions.json",
                      lambda route: route.fulfill(status=200, content_type="application/json; charset=utf-8", body=body))

        def watch(page, label):
            def on_console(m):
                if m.type in ("error", "warning") and "Service Worker registration blocked" not in m.text:
                    errors.append(f"[{label}] console {m.type}: {m.text}")
            page.on("console", on_console)
            page.on("pageerror", lambda e: errors.append(f"[{label}] page error: {e}"))

        def phone(label, scheme="light", questions=None, width=390, height=844):
            ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=2,
                                      is_mobile=True, has_touch=True, color_scheme=scheme,
                                      service_workers="block", locale="fr-FR", timezone_id="Europe/Paris")
            if questions is not None:
                serve(ctx, questions)
            page = ctx.new_page()
            watch(page, label)
            return ctx, page

        def open_reviser(page, hash_="#reviser"):
            page.goto(BASE + hash_)
            page.wait_for_selector(".rv-hero" if hash_ == "#reviser" else ".rv-themehead")
            page.wait_for_timeout(450)

        # ================================================================ 1. the class, today
        ctx, page = phone("today")
        open_reviser(page)
        page.screenshot(path=SHOTS / "01-home-en-preparation.png", full_page=True)
        check("today: home says « Questions en préparation »", "Questions en préparation" in page.locator(".rv-hero").text_content())
        check("today: 6 themes, all « Questions en préparation »",
              page.locator(".rv-theme").count() == 6 and page.locator(".rv-theme.is-soon").count() == 6)
        check("today: nothing to start", page.locator("[data-start]").count() == 0)
        check("today: no « Mes erreurs » yet", "Mes erreurs" not in page.locator("#screen-reviser").inner_text())
        page.goto(BASE + "#reviser/publics")
        page.wait_for_selector(".rv-soon")
        check("today: a theme says « Questions en préparation »", "Questions en préparation" in page.locator(".rv-soon").inner_text())
        page.screenshot(path=SHOTS / "02-theme-en-preparation.png")
        ctx.close()

        # ================================================================ 2. checked questions
        verified = {"anat-1-": 10, "anat-2-": 4, "fil-1-": 5, "fds-1-": 10}
        CHECKED = fixture(verified)
        POOL = {q["id"]: q for q in CHECKED}
        ctx, page = phone("checked", questions=CHECKED)
        open_reviser(page)
        page.screenshot(path=SHOTS / "03-home-checked.png", full_page=True)
        rows = {norm(r.locator(".rv-theme__title").inner_text()): norm(r.locator(".rv-theme__meta").inner_text())
                for r in page.locator(".rv-theme").all()}
        check("anatomie shows 1 lesson (lesson 2 has only 4 checked)", rows.get("Anatomie et mouvement") == "1 leçon · 10 questions")
        check("filières shows its 5 checked questions", rows.get("Filières énergétiques") == "1 leçon · 5 questions")
        check("publics: « Questions en préparation »", rows.get("Les publics et leurs caractéristiques") == "Questions en préparation")
        check("hero proposes lesson 1 with its title", "Leçon 1 · Os et articulations" in norm(page.locator(".rv-hero").inner_text()))

        page.goto(BASE + "#reviser/anatomie-mouvement")
        page.wait_for_selector(".path")
        check("path shows the lesson title", "Os et articulations" in page.locator(".path").inner_text())
        check("path has 1 step (hidden lesson 2)", page.locator(".path__step").count() == 1)

        # Play lesson 1: one wrong answer first, a typo, then everything right.
        page.locator(".rv-themehead [data-start]").click()
        page.wait_for_selector(".player.is-open")
        page.wait_for_timeout(450)
        check("player shows the lesson title", norm(page.locator(".player__heading").inner_text()) == "Leçon 1 · Os et articulations")
        check("starts with 3 lives", page.locator(".player__lives b").inner_text() == "3")
        shown = page.locator(".q-text").text_content()
        check("typography: no normal space before « ? », a no-break space instead",
              " ?" not in shown and (NBSP + "?" in shown or "?" not in shown))
        page.screenshot(path=SHOTS / "04-question.png")
        q1 = answer(page, right=False, pool=POOL)
        page.wait_for_timeout(350)
        page.screenshot(path=SHOTS / "05-wrong.png")
        check("wrong answer costs a life", page.locator(".player__lives b").inner_text() == "2")
        check("question will come back", page.locator(".feedback__again").count() == 1)
        check("no Relecture buttons for checked questions", page.locator(".verdict").count() == 0)
        cont(page)
        seen = [q1["id"]]
        typo_done = False
        for _ in range(20):
            if page.locator(".player-end").count():
                break
            q = find_question(page, POOL)
            if q["type"] == "saisie" and not typo_done and q["id"] != q1["id"]:
                answer(page, right=True, typo=True, pool=POOL)
                page.wait_for_timeout(300)
                page.screenshot(path=SHOTS / "06-typo-accepted.png")
                check("typo accepted with a spelling tip", "orthographe" in page.locator(".feedback__note").inner_text())
                typo_done = True
            else:
                answer(page, right=True, pool=POOL)
            seen.append(q["id"])
            cont(page)
        page.wait_for_selector(".player-end")
        page.wait_for_timeout(900)
        page.screenshot(path=SHOTS / "07-lesson-done.png")
        check("the wrong question came back at the end", seen.count(q1["id"]) == 2)
        check("end screen shows XP", page.locator(".end-stat--xp b").inner_text().startswith("+"))
        check("série started", page.locator(".end-stat--streak b").inner_text() == "1")
        page.locator(".player__actions [data-close]").click()
        page.wait_for_timeout(700)
        check("lands on the theme page, lesson done",
              "#reviser/anatomie-mouvement" in page.url and page.locator(".path__step.is-done").count() == 1)
        saved = page.evaluate("JSON.parse(localStorage.getItem('promo-mapst:reviser'))")
        lesson_ids = [q["id"] for q in CHECKED if q["id"].startswith("anat-1-")]
        check("progress saved by question id", sorted(saved["done"]) == sorted(lesson_ids))
        check("the missed question is saved as « after a mistake »", saved["done"][q1["id"]] == 1)
        check("the others as « first time »", all(saved["done"][i] == 2 for i in lesson_ids if i != q1["id"]))

        # « Mes erreurs »
        page.locator("[data-back]").click()
        page.wait_for_timeout(500)
        check("back goes to the list", page.locator(".rv-hero").count() == 1)
        check("one question to review", page.locator(".rv-errors__title").inner_text().startswith("1 question"))
        page.locator("[data-review]").click()
        page.wait_for_selector(".player.is-open")
        page.wait_for_timeout(400)
        check("review has no lives", page.locator(".player__lives").count() == 0)
        answer(page, right=True, pool=POOL)
        cont(page)
        page.wait_for_selector(".player-end")
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "08-review-done.png")
        page.locator(".player__actions [data-close]").click()
        page.wait_for_timeout(600)
        check("nothing left to review today", "Rien à revoir" in page.locator(".rv-errors__title").inner_text())

        # Lose all the lives (filières: 5 questions), restart, then the hint.
        open_reviser(page, "#reviser/filieres-energetiques")
        page.locator(".rv-themehead [data-start]").click()
        page.wait_for_selector(".player.is-open")
        page.wait_for_timeout(400)
        for _ in range(3):
            answer(page, right=False, pool=POOL)
            cont(page)
        page.wait_for_selector(".player-end--lost")
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "09-lost.png")
        check("« Plus de vies » after 3 mistakes", page.locator(".player-end--lost").count() == 1)
        page.locator("[data-restart]").click()
        page.wait_for_timeout(400)
        check("restart gives 3 lives again", page.locator(".player__lives b").inner_text() == "3")
        for _ in range(6):
            q = find_question(page, POOL)
            if q["type"] == "saisie":
                page.locator("[data-hint]").click()
                page.wait_for_timeout(300)
                page.screenshot(path=SHOTS / "10-hint.png")
                check("hint shown", page.locator(".hint-box").is_visible())
                answer(page, right=True, pool=POOL)
                break
            answer(page, right=True, pool=POOL)
            cont(page)
        page.locator(".player__close").click()
        page.wait_for_selector(".sheet-layer.is-open")
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "11-leave.png")
        check("leaving in the middle asks first", "Quitter la leçon" in page.locator(".sheet__title").inner_text())
        page.locator("[data-leave]").click()
        page.wait_for_timeout(800)
        check("player closed after leaving", page.locator(".player").count() == 0)

        # Fiche de séance: a wrong QCM shows ✓ and ×, then Associer with a mismatch.
        open_reviser(page, "#reviser/fiche-de-seance")
        page.locator(".rv-themehead [data-start]").click()
        page.wait_for_selector(".player.is-open")
        page.wait_for_timeout(400)
        wrong_qcm_done = pairs_done = False
        for _ in range(12):
            q = find_question(page, POOL)
            if q["type"] == "qcm" and not wrong_qcm_done:
                answer(page, right=False, pool=POOL)
                wrong_icon = page.locator(".choice.is-wrong .choice__key use").get_attribute("href")
                right_icons = [u.get_attribute("href") for u in page.locator(".choice.is-missed .choice__key use").all()]
                check("wrong choice shows ×, right ones ✓", wrong_icon == "#i-close" and right_icons and all(h == "#i-check" for h in right_icons))
                wrong_qcm_done = True
                cont(page)
            elif q["type"] == "paires":
                page.locator('[data-side="0"][data-pair="0"]').click()
                page.locator('[data-side="1"][data-pair="0"]').click()
                page.locator('[data-side="0"][data-pair="1"]').click()
                page.wait_for_timeout(300)
                page.screenshot(path=SHOTS / "12-pairs.png")
                page.locator('[data-side="1"][data-pair="2"]').click()
                page.wait_for_timeout(700)
                for i in range(1, len(q["pairs"])):
                    page.locator(f'[data-side="0"][data-pair="{i}"]').click()
                    page.locator(f'[data-side="1"][data-pair="{i}"]').click()
                page.wait_for_selector(".player__bottom.has-feedback")
                page.wait_for_timeout(800)
                page.screenshot(path=SHOTS / "13-pairs-feedback.png")
                check("a mismatch makes the pairs wrong", page.locator(".player__bottom.is-wrong").count() == 1)
                order = page.evaluate("[...document.querySelectorAll('.pairs .pair')].map(b => b.dataset.side + ':' + b.dataset.pair)")
                aligned = all(order[i].startswith("0:") and order[i + 1] == "1:" + order[i][2:] for i in range(0, len(order), 2))
                check("after the answer, each pair sits on one row", aligned)
                check("no sideways scrolling on a phone", no_overflow(page))
                pairs_done = True
                break
            else:
                answer(page, right=True, pool=POOL)
                cont(page)
        check("found a QCM and a pairs question in the lesson", wrong_qcm_done and pairs_done)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
        if page.locator("[data-leave]").count():
            page.locator("[data-leave]").click()
            page.wait_for_timeout(700)

        # ------------------------------------------------ the content changes (ids stay)
        cards_before = page.evaluate("Object.keys(JSON.parse(localStorage.getItem('promo-mapst:reviser')).cards)")
        new_q = dict(BY_ID["anat-1-04"], id="anat-1-99", question="Question ajoutée plus tard pour le test ?", status="verifie")
        dropped = "anat-1-03"
        CHANGED = fixture({"anat-1-": 10, "anat-2-": 10, "fil-1-": 5, "fds-1-": 10}, extra=[new_q], drop=[dropped] + cards_before[:1])
        serve(ctx, CHANGED)
        page.goto(BASE + "#reviser/anatomie-mouvement")
        page.reload()                       # a new visit: the app fetches the content again
        page.wait_for_selector(".path")
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "14-new-questions.png", full_page=True)
        steps = page.locator(".path__step")
        check("a new lesson appears once checked", steps.count() == 2)
        check("lesson 1 shows « Nouveau » (1 new question)", "is-current" in steps.nth(0).get_attribute("class")
              and "Nouveau" in steps.nth(0).text_content())
        check("lesson 2 stays open (lesson 1 was finished)", "is-locked" not in steps.nth(1).get_attribute("class"))
        page.goto(BASE + "#reviser")
        page.wait_for_selector(".rv-hero")
        page.wait_for_timeout(300)
        aside = page.locator(".section__aside").first.text_content()
        check("a removed question leaves « Mes erreurs »", aside.startswith(f"{len(cards_before) - 1} question"))
        ctx.close()

        # ================================================================ 3. Relecture
        ctx, page = phone("relecture")
        ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE.rstrip("/"))
        page.goto(BASE + "#infos")
        page.wait_for_selector("[data-relecture]")
        check("Relecture is off by default", not page.locator("[data-relecture]").is_checked())
        check("the switch explains itself",
              "Affiche les questions pas encore vérifiées. Elles peuvent contenir des erreurs." in norm(page.locator(".rl-switch").inner_text()))
        check("no report link while off", page.locator("[data-report]").count() == 0)
        page.locator(".rl-switch__row").click()
        page.wait_for_timeout(500)
        check("switch on: the report link appears", page.locator("[data-report]").count() == 1)
        page.locator(".rl-switch").scroll_into_view_if_needed()
        page.screenshot(path=SHOTS / "15-infos-relecture.png")

        open_reviser(page)
        check("Réviser shows the Relecture card", "0 sur 70 relues" in norm(page.locator(".rv-relecture").inner_text()))
        check("every theme has its lessons", page.locator(".rv-theme.is-soon").count() == 0)
        page.screenshot(path=SHOTS / "16-home-relecture.png", full_page=True)
        page.goto(BASE + "#reviser/anatomie-mouvement")
        page.wait_for_selector(".path")
        page.wait_for_timeout(300)
        check("every lesson is open", page.locator(".path__step.is-locked").count() == 0 and page.locator(".path__step").count() == 2)
        page.locator('.path__step:nth-child(2) [data-lesson]').click()
        page.wait_for_selector(".sheet-layer.is-open")
        page.wait_for_timeout(300)
        page.locator("[data-go]").click()
        page.wait_for_selector(".player.is-open")
        page.wait_for_timeout(500)
        check("lesson 2 can be played straight away", norm(page.locator(".player__heading").inner_text()) == "Leçon 2 · Muscles et contractions")
        check("« À vérifier » badge with the id", "À vérifier" in page.locator(".player .badge--id").inner_text())
        page.screenshot(path=SHOTS / "17-relecture-question.png")

        # Three verdicts: Juste, À corriger with a note, À corriger without a note.
        judged = []
        note = "la réponse C est aussi juste"
        for step in range(3):
            q = answer(page, right=True)
            page.wait_for_selector(".verdict")
            if q["type"] == "qcm":
                letters = page.evaluate("[...document.querySelectorAll('.choice')].map(b => [b.dataset.choice, b.querySelector('.choice__key').textContent.trim()])")
                check(f"letters A-D of the file on the choices ({q['id']})", all(k == "ABCD"[int(i)] for i, k in letters))
            if q["type"] == "saisie":
                check(f"accepted answers shown in Relecture ({q['id']})", "Réponses acceptées" in page.locator(".feedback").inner_text())
            if step == 0:
                page.locator('.verdict [data-verdict="juste"]').click()
                page.wait_for_timeout(200)
                check("« Juste » is marked", page.locator('.verdict [data-verdict="juste"]').get_attribute("aria-pressed") == "true")
                page.screenshot(path=SHOTS / "18-relecture-juste.png")
            else:
                page.locator(".verdict__btn--fix").click()
                page.wait_for_selector(".sheet-layer.is-open [data-note]")
                page.wait_for_timeout(300)
                if step == 1:
                    page.locator("[data-note]").fill(note)
                    page.screenshot(path=SHOTS / "19-relecture-note.png")
                page.locator("[data-save]").click()
                page.wait_for_timeout(500)
                check(f"« À corriger » is marked ({step})", page.locator(".verdict__btn--fix").get_attribute("aria-pressed") == "true")
                if step == 1:
                    check("the note is shown under the buttons", note in page.locator(".verdict__note").inner_text())
            judged.append(q["id"])
            cont(page)
        page.locator(".player__close").click()
        page.wait_for_selector(".sheet-layer.is-open")
        page.locator("[data-leave]").click()
        page.wait_for_timeout(700)

        # The report
        page.goto(BASE + "#reviser")
        page.wait_for_selector(".rv-relecture")
        check("Relecture card counts 3", "3 sur 70 relues · 2 à corriger" in norm(page.locator(".rv-relecture").inner_text()))
        page.locator(".rv-relecture").click()
        page.wait_for_selector(".rl-head")
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "20-report.png", full_page=True)
        check("report header title", page.locator("#appbar-title").inner_text() == "Relecture")
        check("report counts", "3 sur 70 questions à vérifier" in norm(page.locator(".rl-head").inner_text()))
        check("« À corriger » list has 2 questions with the note",
              page.locator(".rl-item").count() == 2 and note in page.locator(".rl-item").first.inner_text() + page.locator(".rl-item").last.inner_text())
        order = [q["id"] for q in REAL]
        fix = sorted(judged[1:], key=order.index)
        expected = "\n".join([
            f"Relecture Promo MAPST · {report_date()}",
            "À corriger (2) :",
            *[f"- {i} : {note}" if i == judged[1] else f"- {i}" for i in fix],
            f"Juste (1) : {judged[0]}",
        ])
        page.locator("[data-copy]").click()
        page.wait_for_timeout(400)
        copied = page.evaluate("navigator.clipboard.readText()")
        check("« Copier le rapport » copies the expected text", copied == expected)
        if copied != expected:
            print("copied:\n" + copied + "\nexpected:\n" + expected)
        check("the preview shows exactly the copied text", page.locator("[data-preview]").text_content() == expected)

        # Changing a question removes its old verdict (fingerprint).
        changed = fixture({}, change={judged[1]: {"question": BY_ID[judged[1]]["question"] + " (corrigée)"}})
        serve(ctx, changed)
        page.reload()
        page.wait_for_selector(".rl-head")
        page.wait_for_timeout(300)
        check("a changed question loses its old verdict", page.locator(".rl-item").count() == 1
              and "2 sur 70 questions à vérifier" in norm(page.locator(".rl-head").inner_text()))

        # Edit the remaining note from the report.
        page.locator(".rl-item").first.click()
        page.wait_for_selector(".sheet-layer.is-open [data-note]")
        page.locator("[data-note]").fill("explication à revoir")
        page.locator("[data-save]").click()
        page.wait_for_timeout(500)
        check("a note can be changed from the report", "explication à revoir" in page.locator(".rl-item").first.inner_text())

        # Erase: two taps.
        clear = page.locator("[data-clear]")
        clear.scroll_into_view_if_needed()
        clear.click()
        armed = "Touche encore" in clear.inner_text()
        clear.click()
        page.wait_for_timeout(400)
        check("« Effacer le rapport » needs two taps and erases",
              armed and page.evaluate("localStorage.getItem('promo-mapst:relecture')") is None
              and "0 sur 70" in norm(page.locator(".rl-head").inner_text()))
        page.locator("[data-back]").click()
        page.wait_for_timeout(400)
        check("the report's back button opens Infos", "#infos" in page.url and page.locator("[data-relecture]").count() == 1)

        # Switch off: the class view again.
        page.locator(".rl-switch__row").click()
        page.wait_for_timeout(400)
        open_reviser(page)
        check("switch off: back to « Questions en préparation »", page.locator(".rv-theme.is-soon").count() == 6)
        ctx.close()

        # ================================================================ samples still work
        samples = [dict(BY_ID[i], status="exemple", question="[EXEMPLE] " + BY_ID[i]["question"])
                   for i in ("pub-1-01", "pub-1-03", "pub-1-05")]
        ctx, page = phone("samples", questions=fixture({}, drop=[s["id"] for s in samples], extra=samples))
        open_reviser(page, "#reviser/publics")
        check("samples: a lesson of 3 « exemple » questions is shown", page.locator(".path__step").count() == 1
              and "3 questions" in page.locator(".section__aside").last.text_content())
        check("samples: the « Questions d’exemple » note", "Questions d’exemple" in page.locator(".note-box").text_content())
        page.locator(".rv-themehead [data-start]").click()
        page.wait_for_selector(".player.is-open")
        check("samples: « Exemple » badge, no « [EXEMPLE] » in the question",
              "Exemple" in page.locator(".q-kind").text_content() and "[EXEMPLE]" not in page.locator(".q-text").text_content())
        ctx.close()

        # ================================================================ 4. dark mode
        ctx, page = phone("dark", scheme="dark", questions=CHECKED)
        open_reviser(page)
        page.screenshot(path=SHOTS / "21-home-dark.png", full_page=True)
        page.locator(".rv-hero [data-start]").click()
        page.wait_for_selector(".player.is-open")
        page.wait_for_timeout(400)
        answer(page, right=False, pool=POOL)
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "22-wrong-dark.png")
        cont(page)
        answer(page, right=True, pool=POOL)
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "23-right-dark.png")
        ctx.close()

        ctx, page = phone("dark relecture", scheme="dark")
        page.add_init_script("localStorage.setItem('promo-mapst:relecture-mode', 'true')")
        open_reviser(page, "#reviser/role-educateur")
        page.locator(".rv-themehead [data-start]").click()
        page.wait_for_selector(".player.is-open")
        page.wait_for_timeout(400)
        answer(page, right=False)
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "24-relecture-dark.png")
        ctx.close()

        # ================================================================ 5. small phone
        ctx, page = phone("small", questions=CHECKED, width=320, height=640)
        open_reviser(page, "#reviser/fiche-de-seance")
        check("small phone: no sideways scrolling (theme)", no_overflow(page))
        page.locator(".rv-themehead [data-start]").click()
        page.wait_for_selector(".player.is-open")
        page.wait_for_timeout(400)
        check("small phone: no sideways scrolling (lesson)", no_overflow(page))
        page.screenshot(path=SHOTS / "25-small-phone.png")
        ctx.close()

        # ================================================================ 6. laptop
        ctx = browser.new_context(viewport={"width": 1280, "height": 800}, color_scheme="light",
                                  service_workers="block", locale="fr-FR", timezone_id="Europe/Paris")
        serve(ctx, CHECKED)
        page = ctx.new_page()
        watch(page, "laptop")
        open_reviser(page)
        page.screenshot(path=SHOTS / "26-laptop-home.png")
        open_reviser(page, "#reviser/fiche-de-seance")
        page.screenshot(path=SHOTS / "27-laptop-theme.png")
        page.locator(".rv-themehead [data-start]").click()
        page.wait_for_selector(".player.is-open")
        page.wait_for_timeout(500)
        keyboard_ok = False
        for _ in range(10):
            q = find_question(page, POOL)
            if q["type"] == "qcm":
                page.keyboard.press("1")
                page.keyboard.press("Enter")
                page.wait_for_selector(".player__bottom.has-feedback")
                keyboard_ok = True
                break
            answer(page, right=True, pool=POOL)
            cont(page)
        check("keyboard: 1 then Enter checks a QCM", keyboard_ok)
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "28-laptop-player.png")

        # The rules for typed answers, straight from the app's code.
        cases = page.evaluate("""async () => {
            const { checkTyped } = await import('./js/reviser/answer.js');
            const t = (typed, answers) => checkTyped(typed, answers);
            return {
              accents: t('Phosphocreatine', ['phosphocréatine']).ok,
              typoLong: t('phosphocreatin', ['phosphocréatine']).ok,
              typoShort: t('ATb', ['ATP']).ok,
              alternative: t('ilio-psoas', ['psoas', 'ilio-psoas']).ok,
              article: t('La loi de Wolff', ['loi de Wolff']).ok,
              subscript: t('VO2 max', ['VO₂max']).ok,
              dots: t('L 212 1', ['L.212-1']).ok,
              empty: t('  ', ['psoas']).empty === true,
            };
        }""")
        check("typed answers: accents and capitals ignored", cases["accents"])
        check("typed answers: one typo forgiven from 8 letters", cases["typoLong"] and not cases["typoShort"])
        check("typed answers: alternatives, articles, VO₂, dots", cases["alternative"] and cases["article"] and cases["subscript"] and cases["dots"])
        check("typed answers: nothing typed is not an answer", cases["empty"])
        ctx.close()

        # ================================================================ 7. the rest still works
        ctx, page = phone("others")
        page.goto(BASE + "#planning")
        page.wait_for_selector(".now", timeout=10000)
        check("planning still loads", page.locator(".now").count() == 1)
        page.goto(BASE + "#etudier")
        page.wait_for_timeout(500)
        check("étudier still says « Bientôt »", "Bientôt" in page.locator("#screen-etudier").inner_text())
        ctx.close()
        browser.close()
finally:
    server.terminate()

check("no console or page errors", not errors)
print("\n".join(f"{'PASS' if ok else 'FAIL'}  {name}" for name, ok in results))
passed = sum(ok for _, ok in results)
print(f"\n{passed}/{len(results)} checks passed. Screenshots: {SHOTS}")
for e in errors:
    print("  ", e)
sys.exit(0 if passed == len(results) else 1)
