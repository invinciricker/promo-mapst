"""
Test of the lessons of Cours (Phase 5, « Les leçons »), in a phone-sized Chromium, like a
person would use them: open a lesson from its chapter, go forward and back (taps on the
right two thirds and the left third, swipes, arrow keys), answer a question wrong and one
right, leave with × in the middle and come back to the same card, reach the last card
(« Leçon terminée »), « Retour au chapitre » and « Teste-toi ». Then a made-up lesson with
every block of docs/AJOUTER-UNE-LECON.md (served to this phone only), a lesson that cannot
load, the « Mode relecture » on a lesson and its report, dark mode, a small phone and
« reduce motion ».

    python3 tests/test_lecons.py [<repo folder>] [<screenshots folder>]

Needs Python Playwright (pip install playwright) and its Chromium (or CHROME_PATH).
Screenshots at 390 × 844, light and dark: a text card, a card with a table, a question
answered, the last card (their folder is printed at the end).
"""
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(tempfile.mkdtemp(prefix="promo-mapst-lecons-"))
SHOTS.mkdir(parents=True, exist_ok=True)
INDEX = json.loads((REPO / "content/lecons/index.json").read_text(encoding="utf-8"))
FICHE = "fiche-de-seance-les-bases"         # 9 cards, questions on cards 3 and 8
FILIERES = "filieres-les-trois"             # 8 cards, a table on card 2
NBSP = " "
VISIBLE = ".panel.is-on .page:not([hidden])"
PLAYER = ".player--lecon"

results = []
errors = []


def check(name, ok):
    results.append((name, bool(ok)))
    if not ok:
        print(f"FAIL  {name}", flush=True)


def norm(text):
    return re.sub(r"\s+", " ", (text or "").replace(NBSP, " ")).strip()


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


# A made-up lesson with every block, in the chapter « De la séance au cycle » (empty today).
MADE_UP = {"id": "essai-tous-les-blocs", "chapitre": "seance-et-cycle", "title": "Une leçon d’essai",
           "minutes": 4, "source": "Test", "status": "brouillon", "added": "2026-11-10"}
MADE_UP_MD = """## Tous les blocs

Un paragraphe avec du **gras**,
sur deux lignes.

1. Premier
2. Deuxième

> [!exemple] Un exemple du terrain.

> [!piege] Une erreur courante.

> [!savais-tu] Un fait étonnant.

> Une citation sans nom de boîte.

### Un sous-titre (texte simple)

## Un tableau très large

| Colonne un | Colonne deux | Colonne trois | Colonne quatre | Colonne cinq | Colonne six |
|---|---|---|---|---|---|
| Anticonstitutionnellement | Deux | Trois | Quatre | Cinq | Six |

![Un schéma de test](img/essai.svg)

## Une question à quatre choix

? Combien de choix ?
- [ ] Un
- [ ] Deux
- [ ] Trois
- [x] Quatre
= Il y en a quatre.

## Une question mal écrite

? Une question sans bonne réponse
- [ ] Non
- [ ] Toujours non
"""
PICTURE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120"><rect width="300" height="120" fill="#7766EE"/></svg>'


PORT = free_port()
BASE = f"http://127.0.0.1:{PORT}/"
server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=REPO,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None)

        def phone(label, scheme="light", storage=None, width=390, height=844, made_up=False, broken=False):
            ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=2,
                                      is_mobile=True, has_touch=True, color_scheme=scheme,
                                      service_workers="block", locale="fr-FR", timezone_id="Europe/Paris")
            setup = {"promo-mapst:bienvenue": "true", "promo-mapst:prenom": json.dumps("Sam")}
            setup.update(storage or {})
            ctx.add_init_script("if (!sessionStorage.getItem('seeded')) {" + "".join(
                f"localStorage.setItem({json.dumps(k)}, {json.dumps(v)});" for k, v in setup.items())
                + "sessionStorage.setItem('seeded', '1'); }")
            if made_up:
                index = dict(INDEX, lecons=INDEX["lecons"] + [MADE_UP])
                ctx.route("**/content/lecons/index.json", lambda route: route.fulfill(
                    status=200, content_type="application/json; charset=utf-8", body=json.dumps(index, ensure_ascii=False)))
                ctx.route(f"**/content/lecons/{MADE_UP['id']}.md", lambda route: route.fulfill(
                    status=200, content_type="text/markdown; charset=utf-8", body=MADE_UP_MD))
                ctx.route("**/content/lecons/img/essai.svg", lambda route: route.fulfill(
                    status=200, content_type="image/svg+xml", body=PICTURE))
            if broken:
                ctx.route(f"**/content/lecons/{FILIERES}.md", lambda route: route.fulfill(status=404, body="absent"))
            page = ctx.new_page()

            def on_console(m):
                if m.type in ("error", "warning") and "Service Worker registration blocked" not in m.text and not (broken and "404" in m.text):
                    errors.append(f"[{label}] console {m.type}: {m.text}")
            page.on("console", on_console)
            page.on("pageerror", lambda e: errors.append(f"[{label}] page error: {e}"))
            return ctx, page

        def open_(page, hash_):
            page.goto(BASE + hash_)
            page.wait_for_selector(VISIBLE)
            page.wait_for_timeout(500)

        def visible_path(page):
            return page.evaluate(f"document.querySelector('{VISIBLE}').dataset.path")

        def shot(page, name):
            page.screenshot(path=SHOTS / f"{name}.png")

        def open_lesson(page, chapter, lesson_id):
            open_(page, f"#cours/{chapter}")
            page.locator(f"{VISIBLE} [data-lecon='{lesson_id}']").click()
            page.wait_for_selector(f"{PLAYER}.is-open .lcard__inner:not(.lc-wait)")
            page.wait_for_timeout(500)

        def title(page):
            el = page.locator(f"{PLAYER} .lcard:last-child .lcard__title, {PLAYER} .lcard:last-child .lc-end__title")
            return norm(el.first.inner_text()) if el.count() else ""

        def filled(page):
            return page.locator(f"{PLAYER} .lecon__segs i.is-on").count()

        def tap(page, x, y=420):
            page.mouse.click(x, y)
            page.wait_for_timeout(560)

        def swipe(page, x0, x1, y=420):
            page.evaluate("""([x0, x1, y]) => {
              const el = document.elementFromPoint(x0, y);
              const touch = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
              el.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(x0)], changedTouches: [touch(x0)], bubbles: true, cancelable: true }));
              el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touch(x1)], bubbles: true, cancelable: true }));
            }""", [x0, x1, y])
            page.wait_for_timeout(560)

        def saved(page):
            return json.loads(page.evaluate("localStorage.getItem('promo-mapst:lecons') || '{}'"))

        # ================================================================ 1. A whole lesson
        ctx, page = phone("lecon")
        open_lesson(page, "fiche-de-seance", FICHE)
        check("a lesson opens full screen over its chapter, with its address",
              page.url.endswith(f"#cours/fiche-de-seance?lecon={FICHE}") and visible_path(page) == "cours/fiche-de-seance"
              and page.locator(".tabbar").evaluate("e => getComputedStyle(e).visibility") == "hidden")
        head = page.locator(f"{PLAYER} .player__head")
        check("the top row is on the gradient of Cours: ×, then one segment per card (9 cards + the last one)",
              "linear-gradient" in head.evaluate("e => getComputedStyle(e).backgroundImage")
              and page.locator(f"{PLAYER} .player__close").count() == 1 and page.locator(f"{PLAYER} .lecon__segs i").count() == 10
              and filled(page) == 1)
        check("card 1: its title (with the no-break space before « ? »)", page.locator(f"{PLAYER} .lcard__title").inner_text() == f"Une fiche, pour quoi faire{NBSP}?")
        sizes = page.evaluate(f"""(() => {{ const t = getComputedStyle(document.querySelector('{PLAYER} .lcard__title'));
            const b = getComputedStyle(document.querySelector('{PLAYER} .lc-p'));
            return [t.fontSize, t.fontWeight, b.fontSize, b.userSelect]; }})()""")
        check("the title is 24 px / 800, the text 17 px, and the text can be selected", sizes == ["24px", "800", "17px", "text"])
        check("card 1: a list with coloured markers and the box « À retenir » (turquoise)",
              page.locator(f"{PLAYER} .lc-list li").count() == 3
              and page.evaluate(f"getComputedStyle(document.querySelector('{PLAYER} .lc-list li'), '::before').backgroundColor") != "rgba(0, 0, 0, 0)"
              and norm(page.locator(f"{PLAYER} .lc-box__label").inner_text()) == "À retenir"
              and "tone-turquoise" in page.locator(f"{PLAYER} .lc-box").get_attribute("class"))
        check("card 1 says how to move on", "Touche à droite ou glisse pour avancer" in norm(page.locator(f"{PLAYER} .lc-hint").inner_text()))
        shot(page, "40-lecon-carte-texte-light")

        page.mouse.click(300, 420)
        page.wait_for_timeout(80)
        sliding = page.locator(f"{PLAYER} .lcard").count() == 2 and page.locator(f"{PLAYER} .lcard.is-moving").count() == 1
        page.wait_for_timeout(500)
        check("a tap on the right two thirds: the next card slides in", sliding and title(page) == "En tableau, et lisible" and filled(page) == 2
              and page.locator(f"{PLAYER} .lcard").count() == 1)
        tap(page, 60)
        check("a tap on the left third: the previous card", title(page) == "Une fiche, pour quoi faire ?" and filled(page) == 1)
        tap(page, 60)
        check("on the first card, back does nothing", title(page) == "Une fiche, pour quoi faire ?")
        swipe(page, 320, 120)
        check("a swipe to the left: the next card", title(page) == "En tableau, et lisible")
        swipe(page, 100, 330)
        check("a swipe to the right: the previous card", title(page) == "Une fiche, pour quoi faire ?")
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(560)
        check("→ on a keyboard: the next card", title(page) == "En tableau, et lisible")
        tap(page, 300)
        check("card 3, a question", title(page) == "Un objectif commence par un verbe" and page.locator(f"{PLAYER} .lc-q").count() == 1)

        # The question blocks the way forward until it is answered.
        tap(page, 300, 200)
        check("going forward is blocked until the question is answered (it shakes)", title(page) == "Un objectif commence par un verbe"
              and "is-shaking" in page.locator(f"{PLAYER} .lc-q").get_attribute("class"))
        page.locator(f"{PLAYER} .lc-q [data-right=false]").first.click()
        page.wait_for_timeout(700)
        q = page.locator(f"{PLAYER} .lc-q")
        check("a wrong answer: bougainvillier on it, turquoise on the right one, like in Réviser",
              q.locator(".choice.is-wrong").count() == 1 and q.locator(".choice.is-missed").count() == 1
              and q.locator(".choice.is-wrong").evaluate("e => getComputedStyle(e).backgroundColor") == "rgb(253, 231, 239)"
              and q.locator(".choice.is-missed").evaluate("e => getComputedStyle(e).backgroundColor") == "rgb(220, 250, 242)"
              and q.locator(".choice:not([disabled])").count() == 0)
        check("… and the explanation appears", "Pas tout à fait" in norm(q.inner_text())
              and "Un objectif commence par un verbe d’action" in norm(q.inner_text()).replace("'", "’"))
        check("no XP, no lives in a lesson", page.locator(f"{PLAYER} .player__lives, {PLAYER} .end-stat").count() == 0)
        shot(page, "42-lecon-question-light")
        tap(page, 300, 200)
        check("once answered, forward works", title(page) == "Trois parties")
        check("the numbered list has its numbers", page.locator(f"{PLAYER} .lc-list--num li").count() == 3)
        tap(page, 60)
        check("back on the question: still answered, not blocking", page.locator(f"{PLAYER} .lc-q .choice.is-wrong").count() == 1)
        tap(page, 300, 200)
        tap(page, 300)
        check("card 5", title(page) == "L'échauffement : 15 à 30 minutes" and filled(page) == 5)
        check("the card on screen is saved on the phone (promo-mapst:lecons)", saved(page).get(FICHE, {}).get("at") == 4)

        # Leave in the middle (×), come back: the same card.
        page.locator(f"{PLAYER} .player__close").click()
        page.wait_for_timeout(800)
        check("× closes the lesson: back on the chapter", page.locator(".player").count() == 0 and visible_path(page) == "cours/fiche-de-seance"
              and page.url.endswith("#cours/fiche-de-seance"))
        page.locator(".tab[data-tab=cours]").click()
        page.wait_for_timeout(900)
        check("the glass card of Cours now says « Continuer »", "Continuer · 5 min" in norm(page.locator(f"{VISIBLE} .hd .gcard").inner_text()))
        page.locator(f"{VISIBLE} .hd .gcard").click()
        page.wait_for_selector(f"{PLAYER}.is-open .lcard__title")
        page.wait_for_timeout(500)
        check("reopening the lesson resumes on the card where it was left", title(page) == "L'échauffement : 15 à 30 minutes" and filled(page) == 5
              and page.locator(f"{PLAYER} .lc-hint").count() == 0)
        page.reload()
        page.wait_for_selector(f"{PLAYER}.is-open .lcard__title")
        page.wait_for_timeout(500)
        check("opened on its address (reload): the lesson, on the same card", title(page) == "L'échauffement : 15 à 30 minutes")
        tap(page, 60)
        check("cards before the saved one don't block (their question was passed)", page.locator(f"{PLAYER} .lc-q").count() == 0
              and title(page) == "Trois parties")
        tap(page, 60)
        tap(page, 300, 200)
        check("… even a question not answered this time", title(page) == "Trois parties")
        for _ in range(4):
            tap(page, 300, 200)
        check("card 8, the second question", title(page) == "Une variante plus, une variante moins")
        page.locator(f"{PLAYER} .lc-q [data-right=true]").click()
        page.wait_for_timeout(700)
        check("a right answer: turquoise, « Bonne réponse ! » and the explanation",
              page.locator(f"{PLAYER} .lc-q .choice.is-right").count() == 1 and page.locator(f"{PLAYER} .lc-q .choice.is-wrong").count() == 0
              and "Bonne réponse" in page.locator(f"{PLAYER} .lc-q__result").inner_text() and page.locator(f"{PLAYER} .lc-q__expl").count() == 1)
        tap(page, 300, 200)
        tap(page, 300, 200)
        end = page.locator(f"{PLAYER} .lc-end")
        check("the last card, added by the app: « Leçon terminée », a check that pops, the lesson's title",
              end.count() == 1 and norm(end.locator(".lc-end__title").inner_text()) == "Leçon terminée"
              and page.evaluate(f"getComputedStyle(document.querySelector('{PLAYER} .lc-end__check')).animationName") == "pop-big"
              and filled(page) == 10)
        check("… « Teste-toi » (the chapter has a theme) and « Retour au chapitre »",
              [norm(t) for t in end.locator(".btn").all_inner_texts()] == ["Teste-toi", "Retour au chapitre"]
              and "btn--primary" in end.locator("[data-test]").get_attribute("class"))
        check("no Relecture buttons for the class", page.locator(f"{PLAYER} .verdict").count() == 0)
        check("reaching the last card marks the lesson as read", bool(saved(page).get(FICHE, {}).get("read")))
        page.wait_for_timeout(500)
        shot(page, "43-lecon-fin-light")
        tap(page, 300, 780)
        check("on the last card, forward does nothing", page.locator(f"{PLAYER} .lc-end").count() == 1)
        page.locator(f"{PLAYER} [data-back-chapter]").click()
        page.wait_for_timeout(900)
        check("« Retour au chapitre »: the chapter, the lesson with a check", visible_path(page) == "cours/fiche-de-seance" and page.locator(".player").count() == 0
              and page.locator(f"{VISIBLE} .lesson-row .lesson-row__check").count() == 1)
        page.locator(f"{VISIBLE} [data-lecon='{FICHE}']").click()
        page.wait_for_selector(f"{PLAYER}.is-open .lcard__title")
        page.wait_for_timeout(500)
        check("a lesson read starts again from its first card", title(page) == "Une fiche, pour quoi faire ?")
        page.keyboard.press("Escape")
        page.wait_for_timeout(800)
        check("Escape closes the lesson (on a laptop)", page.locator(".player").count() == 0)
        page.locator(".tab[data-tab=cours]").click()
        page.wait_for_timeout(900)
        check("the path: the pill « 1 leçon » is filled, the glass card moves to the next lesson",
              "pill--done" in page.locator(f"{VISIBLE} .chap").nth(0).locator(".pill").first.get_attribute("class")
              and INDEX["lecons"][1]["title"] in page.locator(f"{VISIBLE} .hd .gcard").inner_text())

        # « Teste-toi »: the theme of the chapter in Réviser.
        page.goto(BASE + f"#cours/fiche-de-seance?lecon={FICHE}")
        page.reload()
        page.wait_for_selector(f"{PLAYER}.is-open .lcard__title")
        page.evaluate(f"localStorage.setItem('promo-mapst:lecons', JSON.stringify({{'{FICHE}': {{ at: 8 }} }}))")
        page.locator(f"{PLAYER} .player__close").click()
        page.wait_for_timeout(700)
        page.locator(f"{VISIBLE} [data-lecon='{FICHE}']").click()
        page.wait_for_selector(f"{PLAYER}.is-open .lcard__title")
        page.wait_for_timeout(400)
        tap(page, 300, 200)
        page.locator(f"{PLAYER} [data-test]").click()
        page.wait_for_timeout(1400)
        check("« Teste-toi » opens the theme of the chapter in Réviser", page.locator(".player").count() == 0 and visible_path(page) == "reviser/fiche-de-seance")
        ctx.close()

        # A card with a table (Les trois filières, card 2).
        for scheme in ("light", "dark"):
            ctx, page = phone(f"tableau {scheme}", scheme=scheme)
            open_lesson(page, "filieres-energetiques", FILIERES)
            if scheme == "dark":
                shot(page, "40-lecon-carte-texte-dark")
            tap(page, 300)
            table = page.locator(f"{PLAYER} .lc-table")
            check(f"a table: rounded, the header in the colour of the chapter, the first column bold ({scheme})",
                  table.count() == 1 and table.locator("th").count() == 3 and table.locator("tbody tr").count() == 3
                  and table.evaluate("e => getComputedStyle(e).borderRadius") == "16px"
                  and table.locator("td").first.evaluate("e => getComputedStyle(e).fontWeight") == "700"
                  and table.locator("td").nth(1).evaluate("e => getComputedStyle(e).fontWeight") == "500")
            shot(page, f"41-lecon-tableau-{scheme}")
            if scheme == "dark":
                tap(page, 300)
                page.locator(f"{PLAYER} .lc-q [data-right=false]").first.click()
                page.wait_for_timeout(700)
                shot(page, "42-lecon-question-dark")
                for _ in range(7):
                    if page.locator(f"{PLAYER} .lc-q .choice:not([disabled])").count():
                        page.locator(f"{PLAYER} .lc-q [data-right=true]").click()
                        page.wait_for_timeout(300)
                    tap(page, 300, 200)
                page.wait_for_timeout(500)
                check("dark mode: the last card", page.locator(f"{PLAYER} .lc-end").count() == 1)
                shot(page, "43-lecon-fin-dark")
            ctx.close()

        # ================================================================ 2. Every block (a made-up lesson)
        ctx, page = phone("blocs", made_up=True)
        open_(page, "#cours")
        check("a lesson added to index.json shows up without code: the empty chapter is no longer washed out",
              "is-empty" not in page.locator(f"{VISIBLE} .chap").nth(1).get_attribute("class")
              and norm(page.locator(f"{VISIBLE} .chap").nth(1).locator(".chap__acts").inner_text()) == "1 leçon")
        open_lesson(page, "seance-et-cycle", MADE_UP["id"])
        card = page.locator(f"{PLAYER} .lcard")
        check("a paragraph on two lines is one paragraph, with **bold**",
              norm(card.locator(".lc-p").first.inner_text()) == "Un paragraphe avec du gras, sur deux lignes."
              and card.locator(".lc-p b").first.inner_text() == "gras")
        classes = [card.locator(".lc-box").nth(i).get_attribute("class") for i in range(card.locator(".lc-box").count())]
        check("the boxes « Exemple » (azur), « Attention » (bougainvillier), « Le savais-tu ? » (soleil)",
              [norm(t) for t in card.locator(".lc-box__label").all_inner_texts()] == ["Exemple", "Attention", "Le savais-tu ?"]
              and len(classes) == 3 and "tone-azur" in classes[0] and "tone-bougainvillier" in classes[1] and "tone-soleil" in classes[2])
        check("anything else is plain text (a quote, a « ### » line)", "Une citation sans nom de boîte." in norm(card.inner_text())
              and "### Un sous-titre (texte simple)" in norm(card.inner_text()))
        tap(page, 300)
        table = page.locator(f"{PLAYER} .lc-table")
        check("a table wider than the card scrolls sideways (the page does not)", table.count() == 1
              and table.evaluate("e => e.scrollWidth > e.clientWidth + 10")
              and page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
        box = table.bounding_box()
        swipe(page, box["x"] + 300, box["x"] + 60, box["y"] + 40)
        check("a swipe on a table that scrolls stays on the card", title(page) == "Un tableau très large")
        picture = page.locator(f"{PLAYER} .lc-img img")
        page.wait_for_timeout(300)
        check("a picture of content/lecons/img/, full width and rounded", picture.count() == 1
              and picture.get_attribute("src") == "content/lecons/img/essai.svg" and picture.get_attribute("alt") == "Un schéma de test"
              and picture.evaluate("e => e.complete && e.naturalWidth > 0")
              and abs(picture.bounding_box()["width"] - (390 - 32)) < 2)
        tap(page, 300)
        check("a question of four choices", page.locator(f"{PLAYER} .lc-q .choice").count() == 4)
        page.locator(f"{PLAYER} .lc-q [data-right=true]").click()
        page.wait_for_timeout(400)
        tap(page, 300)
        check("a question without a right choice is shown as plain text (scripts/check_content.py reports it)",
              page.locator(f"{PLAYER} .lc-q").count() == 0 and "Une question sans bonne réponse" in page.locator(f"{PLAYER} .lcard").inner_text())
        check("no sideways scrolling in a lesson", page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
        ctx.close()

        # A lesson that cannot load (offline and never opened, or a missing file).
        ctx, page = phone("cassee", broken=True)
        open_(page, "#cours/filieres-energetiques")
        page.locator(f"{VISIBLE} [data-lecon='{FILIERES}']").click()
        page.wait_for_selector(f"{PLAYER} .lc-wait .empty")
        check("a lesson that cannot load says so, with « Fermer »", "Cette leçon n’a pas pu se charger." in norm(page.locator(PLAYER).inner_text()))
        page.locator(f"{PLAYER} .lc-wait [data-close]").click()
        page.wait_for_timeout(800)
        check("… « Fermer » goes back to the chapter", page.locator(".player").count() == 0 and visible_path(page) == "cours/filieres-energetiques")
        page.goto(BASE + "#cours/filieres-energetiques?lecon=nexiste-pas")
        page.reload()
        page.wait_for_timeout(900)
        check("an unknown lesson in the address: just the chapter", page.locator(".player").count() == 0 and visible_path(page) == "cours/filieres-energetiques")
        ctx.close()

        # ================================================================ 3. Relecture
        ctx, page = phone("relecture", storage={"promo-mapst:relecture-mode": "true"})
        open_(page, "#cours/filieres-energetiques")
        check("Relecture: a lesson not checked yet has the « À vérifier » badge on its row",
              norm(page.locator(f"{VISIBLE} .lesson-row .tag.tone-citron").inner_text()) == "À vérifier")
        page.locator(f"{VISIBLE} [data-lecon='{FILIERES}']").click()
        page.wait_for_selector(f"{PLAYER}.is-open .lcard__title")
        page.wait_for_timeout(400)
        for _ in range(9):
            if page.locator(f"{PLAYER} .lc-end").count():
                break
            if page.locator(f"{PLAYER} .lc-q .choice:not([disabled])").count():
                page.locator(f"{PLAYER} .lc-q [data-right=true]").click()
                page.wait_for_timeout(300)
            tap(page, 300, 200)
        verdict = page.locator(f"{PLAYER} .lc-end .verdict")
        check("Relecture: the last card has « Juste » / « À corriger »", verdict.count() == 1
              and "cette leçon est-elle juste" in norm(verdict.inner_text()))
        verdict.locator("[data-verdict=juste]").click()
        page.wait_for_timeout(300)
        stored = json.loads(page.evaluate("localStorage.getItem('promo-mapst:relecture')"))
        check("« Juste » is saved like the questions' verdicts, under lecon:<id>",
              stored.get(f"lecon:{FILIERES}", {}).get("v") == "juste" and verdict.locator("[data-verdict=juste]").get_attribute("aria-pressed") == "true")
        verdict.locator("[data-verdict=corriger]").click()
        page.wait_for_selector(".sheet-layer.is-open [data-note]")
        page.locator("[data-note]").fill("la carte 4 est trop longue")
        page.locator("[data-save]").click()
        page.wait_for_timeout(700)
        check("« À corriger » with a note", "la carte 4 est trop longue" in page.locator(f"{PLAYER} .verdict__note").inner_text())
        shot(page, "44-lecon-relecture-light")
        page.locator(f"{PLAYER} [data-back-chapter]").click()
        page.wait_for_timeout(800)
        page.goto(BASE + "#accueil/profil/relecture")
        page.reload()
        page.wait_for_selector(f"{VISIBLE} .rl-head")
        page.wait_for_timeout(1500)
        report = page.locator(f"{VISIBLE} [data-preview]").text_content()
        check("the report: the questions as before, then « Leçons » with the lesson to correct",
              report.endswith(f"\n\nLeçons\nÀ corriger (1) :\n- {FILIERES} : la carte 4 est trop longue\nJuste (0)")
              and "\nÀ corriger (0)\nJuste (0)\n" in report)
        check("the report page: the lesson in « À corriger », and a « Leçons » list",
              page.locator(f"{VISIBLE} [data-edit-lecon='{FILIERES}']").count() == 1
              and page.locator(f"{VISIBLE} [data-lecon-link]").count() == sum(1 for l in INDEX["lecons"] if l["status"] == "brouillon")
              and page.locator(f"{VISIBLE} [data-copy]").is_enabled())
        page.locator(f"{VISIBLE} [data-lecon-link='filieres-energetiques']").scroll_into_view_if_needed()
        shot(page, "45-rapport-lecons-light")
        # The lesson is rewritten: its old verdict disappears (fingerprint).
        changed = (REPO / f"content/lecons/{FILIERES}.md").read_text(encoding="utf-8") + "\nUne ligne de plus.\n"
        ctx.route(f"**/content/lecons/{FILIERES}.md", lambda route: route.fulfill(status=200, content_type="text/markdown; charset=utf-8", body=changed))
        page.reload()
        page.wait_for_selector(f"{VISIBLE} .rl-head")
        page.wait_for_timeout(1500)
        check("a rewritten lesson loses its old verdict", page.locator(f"{VISIBLE} [data-edit-lecon]").count() == 0
              and page.locator(f"{VISIBLE} [data-preview]").count() == 0)
        ctx.close()

        # ================================================================ 4. Small phone, less motion
        ctx, page = phone("petit", width=320, height=640)
        open_lesson(page, "filieres-energetiques", FILIERES)
        tap(page, 250)
        check("small phone: the table fits or scrolls inside, the page never scrolls sideways",
              page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
        ctx.close()
        ctx, page = phone("moins de mouvement")
        page.emulate_media(reduced_motion="reduce")
        open_lesson(page, "fiche-de-seance", FICHE)
        page.mouse.click(300, 420)
        page.wait_for_timeout(60)
        check("reduce motion: the next card is simply there", page.locator(f"{PLAYER} .lcard").count() == 1 and title(page) == "En tableau, et lisible")
        ctx.close()
        browser.close()
except Exception:
    print("\n".join(f"{'PASS' if ok else 'FAIL'}  {name}" for name, ok in results))
    for e in errors:
        print("  ", e)
    raise
finally:
    server.terminate()

check("no console or page errors", not errors)
print("\n".join(f"{'PASS' if ok else 'FAIL'}  {name}" for name, ok in results))
passed = sum(ok for _, ok in results)
print(f"\n{passed}/{len(results)} checks passed. Screenshots: {SHOTS}")
for e in errors:
    print("  ", e)
sys.exit(0 if passed == len(results) else 1)
