"""
End-to-end test of the Réviser tab of Promo MAPST, in a phone-sized Chromium.

    python3 tests/test_reviser.py [<repo folder>] [<screenshots folder>]

Needs Python Playwright (pip install playwright) and its Chromium. Set CHROME_PATH to use
another Chromium. It starts a small local web server, plays lessons like a person would,
and prints PASS or FAIL for each check (the exit code is 1 if one fails).

The real content/questions.json is used as it is: its questions are "brouillon", and since
7 Nov 2026 the class sees them (a lesson appears once it has 5 "brouillon" or "verifie"
questions). To test other cases (a question added later, a lesson too small...), the
test serves a changed copy of the file (the "fixtures"). The Relecture is tested by
switching the mode on in Profil. The welcome is skipped by saving a first name first.
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
VISIBLE = ".panel.is-on .page:not([hidden])"     # the page shown now

results = []
errors = []


def check(name, ok):
    results.append((name, bool(ok)))
    if not ok:
        print(f"FAIL  {name}", flush=True)


def norm(text):
    return re.sub(r"\s+", " ", (text or "").replace(NBSP, " ")).strip()


BY_TEXT = {norm(q["question"]): q for q in REAL}
assert len(BY_TEXT) == len(REAL), "two questions have the same text: the test can't tell them apart"


def fixture(status=None, extra=(), drop=(), change=None):
    """A copy of the real questions, with some changes."""
    out = []
    for q in REAL:
        if q["id"] in drop:
            continue
        q = dict(q)
        if status:
            q["status"] = status
        if change and q["id"] in change:
            q.update(change[q["id"]])
        out.append(q)
    return out + list(extra)


# ---------------------------------------------------------------------------------------
# Playing
# ---------------------------------------------------------------------------------------
def find_question(page, pool=None):
    """The question on screen: by its id in Relecture (badge), otherwise by its text."""
    badge = page.locator(".player .q-kind__id")
    if badge.count():
        qid = norm(badge.first.inner_text()).split("·")[-1].strip()
        return (pool or BY_ID)[qid]
    text = norm(page.locator(".player .q-text").inner_text())
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
            # Skip the welcome: a first name is already saved.
            ctx.add_init_script("localStorage.setItem('promo-mapst:bienvenue', 'true');"
                                "if (!localStorage.getItem('promo-mapst:prenom')) localStorage.setItem('promo-mapst:prenom', '\"Sam\"');")
            if questions is not None:
                serve(ctx, questions)
            page = ctx.new_page()
            watch(page, label)
            return ctx, page

        def open_reviser(page, hash_="#reviser"):
            page.goto(BASE + hash_)
            page.reload()
            page.wait_for_selector(f"{VISIBLE} .gcard" if hash_ == "#reviser" else f"{VISIBLE} .theme-head")
            page.wait_for_timeout(450)

        def start(page, selector):
            page.locator(selector).first.click()
            page.wait_for_selector(".player.is-open")
            page.wait_for_timeout(450)

        def lessons(page):
            return [l.get_attribute("class") for l in page.locator(f"{VISIBLE} .path .lesson").all()]

        # ================================================================ 1. the class, today
        ctx, page = phone("today")
        open_reviser(page)
        page.screenshot(path=SHOTS / "01-home.png")
        tiles = page.locator(f"{VISIBLE} .tile")
        check("the 6 themes have lessons (brouillon questions are shown to everyone)",
              tiles.count() == 6 and "Questions en préparation" not in page.locator(f"{VISIBLE} .grid").inner_text())
        card = norm(page.locator(f"{VISIBLE} .gcard").inner_text())
        check("the glass card proposes lesson 1 of the first theme, « Commencer »", "Os et articulations" in card and "Commencer" in card
              and "0/10" in page.locator(f"{VISIBLE} .gcard .ring").text_content())
        check("the header: série and XP as glass chips", page.locator(f"{VISIBLE} .hd .gchip").count() == 2
              and "0 XP" in page.locator(f"{VISIBLE} .hd").inner_text())
        check("« Mes erreurs » is not shown when there are none", page.locator(f"{VISIBLE} .rv-next").count() == 0
              and "Mes erreurs" not in page.locator(f"{VISIBLE}").inner_text())
        check("the theme tiles are washed with their colour, with a big faint icon", page.locator(f"{VISIBLE} .tile .tile__ghost").count() == 6)
        check("no Relecture card for the class", page.locator(f"{VISIBLE} .rv-relecture").count() == 0)
        check("theme tiles in the colours of the mockups (1st bougainvillier, 2nd soleil)",
              "tone-bougainvillier" in tiles.nth(0).get_attribute("class") and "tone-soleil" in tiles.nth(1).get_attribute("class"))

        page.locator(f"{VISIBLE} .tile[data-theme=anatomie-mouvement]").click()
        page.wait_for_timeout(700)
        check("a theme is a page with « ‹ Réviser » (#reviser/anatomie-mouvement)",
              page.url.endswith("#reviser/anatomie-mouvement") and norm(page.locator(f"{VISIBLE} .back").inner_text()) == "Réviser")
        page.screenshot(path=SHOTS / "02-theme.png")
        classes = lessons(page)
        check("path: lesson 1 to do, lesson 2 locked", len(classes) == 2 and "is-now" in classes[0] and "is-locked" in classes[1])
        check("path: the locked lesson says when it opens", "S’ouvre quand la leçon 1 est finie." in norm(page.locator(f"{VISIBLE} .lesson.is-locked").inner_text()))
        check("path: the lesson titles", "Os et articulations" in page.locator(f"{VISIBLE} .path").inner_text()
              and "Muscles et contractions" in page.locator(f"{VISIBLE} .path").inner_text())
        check("path: « D’autres leçons arrivent au fil des cours. »", "D’autres leçons arrivent au fil des cours." in page.locator(f"{VISIBLE} .path__more").inner_text())

        # Play lesson 1: one wrong answer first, a typo, then everything right.
        start(page, f"{VISIBLE} .lesson.is-now .lesson__btn")
        check("the lesson has its own address (?lecon=…)", "?lecon=anatomie-mouvement-1" in page.url)
        check("player shows the lesson title", norm(page.locator(".player__heading").inner_text()) == "Leçon 1 · Os et articulations")
        check("starts with 3 lives", page.locator(".player__lives b").inner_text() == "3")
        check("no « À vérifier » badge for the class", page.locator(".player .q-kind__id").count() == 0)
        shown = page.locator(".q-text").text_content()
        check("typography: no normal space before « ? », a no-break space instead",
              " ?" not in shown and (NBSP + "?" in shown or "?" not in shown))
        page.screenshot(path=SHOTS / "03-question.png")
        q1 = answer(page, right=False)
        page.wait_for_timeout(450)
        page.screenshot(path=SHOTS / "04-wrong.png")
        check("wrong answer costs a life", page.locator(".player__lives b").inner_text() == "2")
        check("the feedback is bougainvillier with « Continuer »", page.locator(".player__bottom.is-wrong").count() == 1
              and "btn--bad" in page.locator(".player [data-main]").get_attribute("class"))
        check("question will come back", page.locator(".feedback__again").count() == 1)
        check("no Relecture buttons for the class", page.locator(".verdict").count() == 0)
        cont(page)
        seen = [q1["id"]]
        typo_done = False
        for _ in range(20):
            if page.locator(".player-end").count():
                break
            q = find_question(page)
            if q["type"] == "saisie" and not typo_done and q["id"] != q1["id"]:
                answer(page, right=True, typo=True)
                page.wait_for_timeout(350)
                page.screenshot(path=SHOTS / "05-typo-accepted.png")
                check("typo accepted with a spelling tip", "orthographe" in page.locator(".feedback__note").inner_text())
                check("the feedback is turquoise when right", page.locator(".player__bottom.is-right").count() == 1)
                typo_done = True
            else:
                answer(page, right=True)
            seen.append(q["id"])
            cont(page)
        page.wait_for_selector(".player-end")
        page.wait_for_timeout(900)
        page.screenshot(path=SHOTS / "06-lesson-done.png")
        check("the wrong question came back at the end", seen.count(q1["id"]) == 2)
        check("end screen shows XP", page.locator(".end-stat--xp b").inner_text().startswith("+"))
        check("série started", page.locator(".end-stat--streak b").inner_text() == "1")
        page.locator(".player__actions [data-close]").click()
        page.wait_for_timeout(800)
        classes = lessons(page)
        check("back on the theme: lesson 1 done, lesson 2 open",
              page.url.endswith("#reviser/anatomie-mouvement") and "is-done" in classes[0] and "is-now" in classes[1])
        saved = page.evaluate("JSON.parse(localStorage.getItem('promo-mapst:reviser'))")
        lesson_ids = [q["id"] for q in REAL if q["id"].startswith("anat-1-")]
        check("progress saved by question id", sorted(saved["done"]) == sorted(lesson_ids))
        check("the missed question is saved as « after a mistake »", saved["done"][q1["id"]] == 1)
        check("the others as « first time »", all(saved["done"][i] == 2 for i in lesson_ids if i != q1["id"]))
        check("a finished lesson is not kept as « to continue »", not saved.get("runs"))

        # « Mes erreurs »
        page.locator(f"{VISIBLE} .back").click()
        page.wait_for_timeout(700)
        check("back goes to the home of Réviser", page.locator(f"{VISIBLE} .rv-next").count() == 1)
        check("one question to review", "1 question à revoir" in norm(page.locator(f"{VISIBLE} .rv-next").inner_text()))
        start(page, f"{VISIBLE} [data-review]")
        check("review has no lives, and its tag", page.locator(".player__lives").count() == 0 and page.locator(".player__tag").count() == 1)
        answer(page, right=True)
        cont(page)
        page.wait_for_selector(".player-end")
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "07-review-done.png")
        page.locator(".player__actions [data-close]").click()
        page.wait_for_timeout(700)
        check("nothing left to review today: the row is gone", page.locator(f"{VISIBLE} .rv-next").count() == 0)

        # Lose all the lives (filières), restart, then the hint.
        open_reviser(page, "#reviser/filieres-energetiques")
        start(page, f"{VISIBLE} .lesson.is-now .lesson__btn")
        missed_ids = []
        for _ in range(3):
            missed_ids.append(answer(page, right=False)["id"])
            cont(page)
        page.wait_for_selector(".player-end--lost")
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "08-lost.png")
        check("« Plus de vies » after 3 mistakes", page.locator(".player-end--lost").count() == 1)
        page.locator("[data-restart]").click()
        page.wait_for_timeout(400)
        check("restart gives 3 lives again", page.locator(".player__lives b").inner_text() == "3")
        hint_done = False
        for _ in range(10):
            q = find_question(page)
            if q["type"] == "saisie" and q.get("hint") and not hint_done:
                page.locator("[data-hint]").click()
                page.wait_for_timeout(300)
                page.screenshot(path=SHOTS / "09-hint.png")
                check("hint shown", page.locator(".hint-box").is_visible())
                hint_done = True
            if hint_done and q["type"] != "saisie":
                break
            answer(page, right=True)
            cont(page)
            if hint_done:
                break
        # Leave in the middle: no question asked, the lesson is kept.
        lives_before = page.locator(".player__lives b").inner_text()
        right_before = page.evaluate("JSON.parse(localStorage.getItem('promo-mapst:reviser')).runs['filieres-energetiques:1'].right.length")
        page.locator(".player__close").click()
        page.wait_for_timeout(800)
        check("leaving a lesson in the middle closes it at once", page.locator(".player").count() == 0 and page.locator(".sheet-layer").count() == 0)
        open_reviser(page)
        home = norm(page.locator(f"{VISIBLE} .gcard").inner_text())
        check("the home proposes to continue it, « Continuer la leçon » with N/10 in the ring", "Continuer la leçon" in home
              and "L’ATP et les trois filières" in home and f"{right_before}/10" in page.locator(f"{VISIBLE} .gcard .ring").text_content())
        page.screenshot(path=SHOTS / "10-home-continue.png")
        start(page, f"{VISIBLE} .gcard[data-start]")
        width = page.evaluate("parseFloat(document.querySelector('.player__bar i').style.width)")
        check("« Continuer » starts again where it stopped (bar and lives)", abs(width - right_before * 10) < 0.6
              and page.locator(".player__lives b").inner_text() == lives_before)
        page.reload()                                   # (a goto in the same instant would race with it)
        page.wait_for_selector(".player.is-open")
        page.wait_for_timeout(500)
        check("opened on the lesson's address (reload): the lesson continues", "?lecon=filieres-energetiques-1" in page.url
              and abs(page.evaluate("parseFloat(document.querySelector('.player__bar i').style.width)") - right_before * 10) < 0.6)
        page.locator(".player__close").click()
        page.wait_for_timeout(700)

        # « Mes erreurs » asks before stopping (its XP would be lost).
        # The restart above may have answered some of the 3 missed questions right (the order
        # is random), which takes them out of « Mes erreurs » for today: put them back, so the
        # two reviews below always have questions to show.
        page.evaluate("""(ids) => {
            const s = JSON.parse(localStorage.getItem('promo-mapst:reviser'));
            const d = new Date();
            const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            for (const id of ids) s.cards[id] = { box: 0, due: today, wrong: 1 };
            localStorage.setItem('promo-mapst:reviser', JSON.stringify(s));
        }""", missed_ids)
        open_reviser(page)
        start(page, f"{VISIBLE} [data-review]")
        answer(page, right=True)
        page.locator(".player__close").click()
        page.wait_for_selector(".sheet-layer.is-open")
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "11-leave-review.png")
        check("leaving « Mes erreurs » in the middle asks first", "Arrêter la révision" in page.locator(".sheet__title").inner_text())
        page.locator("[data-leave]").click()
        page.wait_for_timeout(900)
        check("… and « Arrêter » closes it", page.locator(".player").count() == 0)
        start(page, f"{VISIBLE} [data-review]")
        answer(page, right=True)
        page.go_back()                                          # the back button of Android
        page.wait_for_selector(".sheet-layer.is-open")
        page.wait_for_timeout(400)
        check("the back button asks too", "Arrêter la révision" in page.locator(".sheet__title").inner_text() and page.locator(".player").count() == 1)
        page.locator("[data-stay]").click()
        page.wait_for_timeout(600)
        check("« Continuer la révision » stays", page.locator(".player.is-open").count() == 1 and page.locator(".sheet-layer").count() == 0)
        page.locator(".player__close").click()
        page.wait_for_selector(".sheet-layer.is-open")
        page.locator("[data-leave]").click()
        page.wait_for_timeout(800)

        # Fiche de séance: a wrong QCM shows ✓ and ×, then Associer with a mismatch.
        open_reviser(page, "#reviser/fiche-de-seance")
        start(page, f"{VISIBLE} .lesson.is-now .lesson__btn")
        wrong_qcm_done = pairs_done = False
        for _ in range(12):
            q = find_question(page)
            if q["type"] == "qcm" and not wrong_qcm_done:
                answer(page, right=False)
                wrong_icon = page.locator(".choice.is-wrong .choice__mark use").get_attribute("href")
                right_icons = [u.get_attribute("href") for u in page.locator(".choice.is-missed .choice__mark use").all()]
                check("wrong choice shows ×, right ones ✓, in turquoise", wrong_icon == "#i-x" and right_icons and all(h == "#i-check" for h in right_icons))
                page.wait_for_timeout(400)
                page.screenshot(path=SHOTS / "12-qcm-wrong.png")
                wrong_qcm_done = True
                cont(page)
            elif q["type"] == "paires" and not pairs_done:
                page.locator('[data-side="0"][data-pair="0"]').click()
                page.locator('[data-side="1"][data-pair="0"]').click()
                page.locator('[data-side="0"][data-pair="1"]').click()
                page.wait_for_timeout(300)
                page.screenshot(path=SHOTS / "13-pairs.png")
                page.locator('[data-side="1"][data-pair="2"]').click()
                page.wait_for_timeout(700)
                for i in range(1, len(q["pairs"])):
                    page.locator(f'[data-side="0"][data-pair="{i}"]').click()
                    page.locator(f'[data-side="1"][data-pair="{i}"]').click()
                page.wait_for_selector(".player__bottom.has-feedback")
                page.wait_for_timeout(800)
                page.screenshot(path=SHOTS / "14-pairs-feedback.png")
                check("a mismatch makes the pairs wrong", page.locator(".player__bottom.is-wrong").count() == 1)
                order = page.evaluate("[...document.querySelectorAll('.pairs .pair')].map(b => b.dataset.side + ':' + b.dataset.pair)")
                aligned = all(order[i].startswith("0:") and order[i + 1] == "1:" + order[i][2:] for i in range(0, len(order), 2))
                check("after the answer, each pair sits on one row", aligned)
                check("no sideways scrolling on a phone", no_overflow(page))
                pairs_done = True
                if wrong_qcm_done:
                    break
                cont(page)                    # the pairs came first: go on until a QCM
            else:
                answer(page, right=True)
                cont(page)
        check("found a QCM and a pairs question in the lesson", wrong_qcm_done and pairs_done)
        page.keyboard.press("Escape")
        page.wait_for_timeout(700)
        check("Escape leaves the lesson", page.locator(".player").count() == 0)

        # ------------------------------------------------ the content changes (ids stay)
        cards = page.evaluate("JSON.parse(localStorage.getItem('promo-mapst:reviser')).cards")
        today = datetime.now(ZoneInfo("Europe/Paris")).strftime("%Y-%m-%d")
        due = sorted(i for i, c in cards.items() if c["due"] <= today)
        new_q = dict(BY_ID["anat-1-04"], id="anat-1-99", question="Question ajoutée plus tard pour le test ?")
        small = [q["id"] for q in REAL if q["id"].startswith("pub-1-")][:6]       # publics keeps 4: too few
        CHANGED = fixture(extra=[new_q], drop=["anat-1-03", due[0]] + small)
        serve(ctx, CHANGED)
        open_reviser(page, "#reviser/anatomie-mouvement")
        page.screenshot(path=SHOTS / "15-new-question.png")
        classes = lessons(page)
        first = norm(page.locator(f"{VISIBLE} .lesson").first.inner_text())
        check("a finished lesson with a new question: « 1 nouvelle question », « Continuer »",
              "is-now" in classes[0] and "1 nouvelle question" in first and "Continuer" in first)
        check("lesson 2 stays open (lesson 1 was finished)", "is-locked" not in classes[1])
        open_reviser(page)
        left = len([i for i in due[1:] if i not in small])
        row = norm(" ".join(page.locator(f"{VISIBLE} .rv-next").all_inner_texts()))
        check("a removed question leaves « Mes erreurs »",
              (f"{left} question{'s' if left > 1 else ''} à revoir" in row) if left else row == "")
        check("a lesson with fewer than 5 questions is hidden: « Questions en préparation »",
              "Questions en préparation" in norm(page.locator(f"{VISIBLE} .tile[data-theme=publics]").inner_text()))
        open_reviser(page, "#reviser/publics")
        check("… and its theme page says so", "Questions en préparation" in page.locator(f"{VISIBLE} .rv-soon").inner_text())
        ctx.close()

        # ================================================================ 2. Relecture
        ctx, page = phone("relecture")
        ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE.rstrip("/"))
        page.goto(BASE + "#accueil/profil")
        page.wait_for_selector(f"{VISIBLE} [data-relecture]")
        page.wait_for_timeout(400)
        check("Relecture is off by default", not page.locator("[data-relecture]").is_checked())
        check("the switch explains itself", "Pour vérifier les questions et signaler les erreurs." in norm(page.locator(f"{VISIBLE} .list").first.inner_text()))
        check("no report link while off", page.locator("[data-report]").count() == 0)
        page.locator("[data-relecture]").check()
        page.wait_for_timeout(500)
        check("switch on: the report link appears", page.locator(f"{VISIBLE} [data-report]").count() == 1)
        page.screenshot(path=SHOTS / "16-profil-relecture.png")

        open_reviser(page)
        check("Réviser shows the Relecture card", "0 sur 70 relues" in norm(page.locator(f"{VISIBLE} .rv-relecture").inner_text()))
        page.screenshot(path=SHOTS / "17-home-relecture.png")
        open_reviser(page, "#reviser/anatomie-mouvement")
        classes = lessons(page)
        check("every lesson is open", len(classes) == 2 and not any("is-locked" in c for c in classes))
        check("each lesson says how many are checked", "0/10 relues" in page.locator(f"{VISIBLE} .path").inner_text())
        start(page, f"{VISIBLE} .lesson:nth-child(2) .lesson__btn")
        check("lesson 2 can be played straight away", norm(page.locator(".player__heading").inner_text()) == "Leçon 2 · Muscles et contractions")
        check("« À vérifier » badge with the id", "À vérifier · anat-2-" in norm(page.locator(".player .q-kind__id").inner_text()))
        page.screenshot(path=SHOTS / "18-relecture-question.png")

        # Three verdicts: Juste, À corriger with a note, À corriger without a note.
        judged = []
        note = "la réponse C est aussi juste"
        for step in range(3):
            q = answer(page, right=True)
            page.wait_for_selector(".verdict")
            if q["type"] == "qcm":
                letters = page.evaluate("[...document.querySelectorAll('.player .choice')].map(b => [b.dataset.choice, b.querySelector('.choice__mark').textContent.trim()])")
                check(f"letters A-D of the file on the choices ({q['id']})", all(k == "ABCD"[int(i)] for i, k in letters))
            if q["type"] == "saisie":
                check(f"accepted answers shown in Relecture ({q['id']})", "Réponses acceptées" in page.locator(".feedback").inner_text())
            if step == 0:
                page.locator('.verdict [data-verdict="juste"]').click()
                page.wait_for_timeout(200)
                check("« Juste » is marked", page.locator('.verdict [data-verdict="juste"]').get_attribute("aria-pressed") == "true")
                page.screenshot(path=SHOTS / "19-relecture-juste.png")
            else:
                page.locator(".verdict__btn--fix").click()
                page.wait_for_selector(".sheet-layer.is-open [data-note]")
                page.wait_for_timeout(300)
                check(f"the note sheet has its address ({step})", "&note=anat-2-" in page.url or "?note=anat-2-" in page.url)
                if step == 1:
                    page.locator("[data-note]").fill(note)
                    page.screenshot(path=SHOTS / "20-relecture-note.png")
                page.locator("[data-save]").click()
                page.wait_for_timeout(600)
                check(f"« À corriger » is marked ({step})", page.locator(".verdict__btn--fix").get_attribute("aria-pressed") == "true")
                if step == 1:
                    check("the note is shown under the buttons", note in page.locator(".verdict__note").inner_text())
            judged.append(q["id"])
            cont(page)
        page.locator(".player__close").click()
        page.wait_for_timeout(800)

        # The report
        open_reviser(page)
        check("Relecture card counts 3", "3 sur 70 relues · 2 à corriger" in norm(page.locator(f"{VISIBLE} .rv-relecture").inner_text()))
        page.locator(f"{VISIBLE} .rv-relecture").click()
        page.wait_for_selector(f"{VISIBLE} .rl-head")
        page.wait_for_timeout(500)
        check("the report opened from Réviser has « ‹ Réviser »", page.url.endswith("#reviser/relecture")
              and norm(page.locator(f"{VISIBLE} .back").inner_text()) == "Réviser")
        page.goto(BASE + "#accueil/profil/relecture")
        page.reload()
        page.wait_for_selector(f"{VISIBLE} .rl-head")
        page.wait_for_timeout(500)
        page.screenshot(path=SHOTS / "21-report.png", full_page=True)
        check("report title", "Rapport de relecture" in page.locator(f"{VISIBLE} .page-title").inner_text())
        check("report counts", "3 sur 70 questions à vérifier" in norm(page.locator(f"{VISIBLE} .rl-head").inner_text()))
        check("« À corriger » list has 2 questions with the note",
              page.locator(f"{VISIBLE} .rl-item").count() == 2 and note in page.locator(f"{VISIBLE} .rl-item").first.inner_text() + page.locator(f"{VISIBLE} .rl-item").last.inner_text())
        order = [q["id"] for q in REAL]
        fix = sorted(judged[1:], key=order.index)
        expected = "\n".join([
            f"Relecture Promo MAPST · {report_date()}",
            "À corriger (2) :",
            *[f"- {i} : {note}" if i == judged[1] else f"- {i}" for i in fix],
            f"Juste (1) : {judged[0]}",
        ])
        page.locator(f"{VISIBLE} [data-copy]").click()
        page.wait_for_timeout(400)
        copied = page.evaluate("navigator.clipboard.readText()")
        check("« Copier le rapport » copies the expected text", copied == expected)
        if copied != expected:
            print("copied:\n" + copied + "\nexpected:\n" + expected)
        check("the preview shows exactly the copied text", page.locator(f"{VISIBLE} [data-preview]").text_content() == expected)

        # Changing a question removes its old verdict (fingerprint).
        changed = fixture(change={judged[1]: {"question": BY_ID[judged[1]]["question"] + " (corrigée)"}})
        serve(ctx, changed)
        page.reload()
        page.wait_for_selector(f"{VISIBLE} .rl-head")
        page.wait_for_timeout(400)
        check("a changed question loses its old verdict", page.locator(f"{VISIBLE} .rl-item").count() == 1
              and "2 sur 70 questions à vérifier" in norm(page.locator(f"{VISIBLE} .rl-head").inner_text()))

        # Edit the remaining note from the report.
        page.locator(f"{VISIBLE} .rl-item").first.click()
        page.wait_for_selector(".sheet-layer.is-open [data-note]")
        page.locator("[data-note]").fill("explication à revoir")
        page.locator("[data-save]").click()
        page.wait_for_timeout(600)
        check("a note can be changed from the report", "explication à revoir" in page.locator(f"{VISIBLE} .rl-item").first.inner_text())

        # Erase: two taps.
        clear = page.locator(f"{VISIBLE} [data-clear]")
        clear.scroll_into_view_if_needed()
        clear.click()
        armed = "Touche encore" in clear.inner_text()
        clear.click()
        page.wait_for_timeout(400)
        check("« Effacer le rapport » needs two taps and erases",
              armed and page.evaluate("localStorage.getItem('promo-mapst:relecture')") is None
              and "0 sur 70" in norm(page.locator(f"{VISIBLE} .rl-head").inner_text()))
        page.locator(f"{VISIBLE} .back").click()
        page.wait_for_timeout(700)
        check("the report's back button opens Profil", page.url.endswith("#accueil/profil") and page.locator(f"{VISIBLE} [data-relecture]").count() == 1)

        # Switch off: the class view again (no badge, lesson 2 locked again).
        page.locator(f"{VISIBLE} [data-relecture]").uncheck()
        page.wait_for_timeout(400)
        open_reviser(page, "#reviser/anatomie-mouvement")
        check("switch off: lesson 2 locked again", "is-locked" in lessons(page)[1])
        start(page, f"{VISIBLE} .lesson.is-now .lesson__btn")
        check("switch off: no « À vérifier » badge", page.locator(".player .q-kind__id").count() == 0)
        ctx.close()

        # ================================================================ samples still work
        samples = [dict(BY_ID[i], status="exemple", question="[EXEMPLE] " + BY_ID[i]["question"])
                   for i in ("pub-1-01", "pub-1-03", "pub-1-05")]
        others = [q["id"] for q in REAL if q["id"].startswith("pub-1-")]
        ctx, page = phone("samples", questions=fixture(drop=others, extra=samples))
        open_reviser(page)
        check("samples: the « Questions d’exemple » note on the home", "Questions d’exemple" in page.locator(f"{VISIBLE} .note").inner_text())
        open_reviser(page, "#reviser/publics")
        check("samples: a lesson of 3 « exemple » questions is shown", len(lessons(page)) == 1
              and "3 questions" in norm(page.locator(f"{VISIBLE} .theme-head").inner_text()))
        start(page, f"{VISIBLE} .lesson.is-now .lesson__btn")
        check("samples: « Exemple » badge, no « [EXEMPLE] » in the question",
              "Exemple" in page.locator(".player .q-kind").text_content() and "[EXEMPLE]" not in page.locator(".player .q-text").text_content())
        ctx.close()

        # ================================================================ 3. dark mode
        ctx, page = phone("dark", scheme="dark")
        open_reviser(page)
        page.screenshot(path=SHOTS / "22-home-dark.png")
        start(page, f"{VISIBLE} .gcard[data-start]")
        answer(page, right=False)
        page.wait_for_timeout(500)
        page.screenshot(path=SHOTS / "23-wrong-dark.png")
        cont(page)
        answer(page, right=True)
        page.wait_for_timeout(500)
        page.screenshot(path=SHOTS / "24-right-dark.png")
        ctx.close()

        ctx, page = phone("dark relecture", scheme="dark")
        page.add_init_script("localStorage.setItem('promo-mapst:relecture-mode', 'true')")
        open_reviser(page, "#reviser/role-educateur")
        start(page, f"{VISIBLE} .lesson .lesson__btn")
        answer(page, right=False)
        page.wait_for_timeout(500)
        page.screenshot(path=SHOTS / "25-relecture-dark.png")
        ctx.close()

        # ================================================================ 4. small phone
        ctx, page = phone("small", width=320, height=640)
        open_reviser(page, "#reviser/fiche-de-seance")
        check("small phone: no sideways scrolling (theme)", no_overflow(page))
        start(page, f"{VISIBLE} .lesson.is-now .lesson__btn")
        check("small phone: no sideways scrolling (lesson)", no_overflow(page))
        page.screenshot(path=SHOTS / "26-small-phone.png")
        ctx.close()

        # ================================================================ 5. laptop
        ctx = browser.new_context(viewport={"width": 1280, "height": 800}, color_scheme="light",
                                  service_workers="block", locale="fr-FR", timezone_id="Europe/Paris")
        ctx.add_init_script("localStorage.setItem('promo-mapst:bienvenue', 'true'); localStorage.setItem('promo-mapst:prenom', '\"Sam\"');")
        page = ctx.new_page()
        watch(page, "laptop")
        open_reviser(page)
        page.screenshot(path=SHOTS / "27-laptop-home.png")
        open_reviser(page, "#reviser/fiche-de-seance")
        page.screenshot(path=SHOTS / "28-laptop-theme.png")
        start(page, f"{VISIBLE} .lesson.is-now .lesson__btn")
        keyboard_ok = False
        for _ in range(10):
            q = find_question(page)
            if q["type"] == "qcm":
                page.keyboard.press("1")
                page.keyboard.press("Enter")
                page.wait_for_selector(".player__bottom.has-feedback")
                keyboard_ok = True
                break
            answer(page, right=True)
            cont(page)
        check("keyboard: 1 then Enter checks a QCM", keyboard_ok)
        page.wait_for_timeout(400)
        page.screenshot(path=SHOTS / "29-laptop-player.png")

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
