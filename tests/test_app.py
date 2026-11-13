"""
End-to-end test of Promo MAPST (Phase 5, « Les leçons »), in a phone-sized Chromium:
the welcome, Accueil (the living home at different moments of the day, its four skies,
« le mot » with and without the owner's lines), getting around (the four tabs and how they
move, pages, back button, swipe from the edge, tabs that remember, addresses), Cours (the
whole path of 19 chapters, the four filters, an empty chapter, a chapter with a lesson, the
glass card to the next lesson, a chapter with and without documents, the search), the
Planning (Semaine, Mois, Année with its date numbers, details, Dates clés, personal
events), Profil and its pages, and the help to install the app (iPhone Safari, another
browser, an in-app browser, Android). The lessons themselves have their own test:
tests/test_lecons.py.

    python3 tests/test_app.py [<repo folder>] [<screenshots folder>]

Needs Python Playwright (pip install playwright) and its Chromium. Set CHROME_PATH to use
another Chromium. The clock of the browser is set to a chosen moment (for example Monday
9 November 2026 at 10:40, during a class), so the test gives the same result any day.
Screenshots at 390 × 844, light and dark, are saved to compare with
docs/design/prototype.html and mockups.html (their folder is printed at the end).
The Réviser tab has its own test: tests/test_reviser.py.
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
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(tempfile.mkdtemp(prefix="promo-mapst-app-"))
SHOTS.mkdir(parents=True, exist_ok=True)
PLANNING = json.loads((REPO / "content/planning.json").read_text(encoding="utf-8"))
NBSP = " "
VISIBLE = ".panel.is-on .page:not([hidden])"     # the page shown now

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


# The browser's clock, frozen at a chosen moment (then it moves on normally).
CLOCK = """(() => {
  const fixed = new Date("%s").getTime();
  const start = Date.now();
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) { if (args.length) super(...args); else super(fixed + (RealDate.now() - start)); }
    static now() { return fixed + (RealDate.now() - start); }
  }
  globalThis.Date = FakeDate;
})();"""


def swipe(page, x0, x1, y, steps=8):
    """A finger moving from x0 to x1 at height y (touch events, like on a phone)."""
    page.evaluate("""([x0, x1, y, steps]) => {
      const el = document.elementFromPoint(x0, y);
      const touch = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      const fire = (type, x, list) => el.dispatchEvent(new TouchEvent(type, { touches: list ? [touch(x)] : [],
        changedTouches: [touch(x)], bubbles: true, cancelable: true }));
      fire('touchstart', x0, true);
      for (let i = 1; i <= steps; i++) fire('touchmove', x0 + (x1 - x0) * i / steps, true);
      fire('touchend', x1, false);
    }""", [x0, x1, y, steps])


PORT = free_port()
BASE = f"http://127.0.0.1:{PORT}/"
server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=REPO,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None)

        def phone(label, when="2026-11-09T10:40:00+01:00", scheme="light", name="Sam", welcome=True,
                  storage=None, width=390, height=844, user_agent=None, content=None):
            """A phone. user_agent: pretend to be another phone or browser. content: made-up
            content files for this phone only, { "documents.json": {...}, "mots.json": {...} }."""
            ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=2,
                                      is_mobile=True, has_touch=True, color_scheme=scheme, user_agent=user_agent,
                                      service_workers="block", locale="fr-FR", timezone_id="Europe/Paris")
            for file_name, value in (content or {}).items():
                body = json.dumps(value, ensure_ascii=False)
                ctx.route(f"**/content/{file_name}", lambda route, request, body=body: route.fulfill(
                    status=200, content_type="application/json; charset=utf-8", body=body))
            ctx.add_init_script(CLOCK % when)
            setup = {}
            if welcome:
                setup["promo-mapst:bienvenue"] = "true"
            if name:
                setup["promo-mapst:prenom"] = json.dumps(name)
            setup.update(storage or {})
            ctx.add_init_script("if (!sessionStorage.getItem('seeded')) {" + "".join(
                f"localStorage.setItem({json.dumps(k)}, {json.dumps(v)});" for k, v in setup.items())
                + "sessionStorage.setItem('seeded', '1'); }")
            page = ctx.new_page()

            def on_console(m):
                if m.type in ("error", "warning") and "Service Worker registration blocked" not in m.text:
                    errors.append(f"[{label}] console {m.type}: {m.text}")
            page.on("console", on_console)
            page.on("pageerror", lambda e: errors.append(f"[{label}] page error: {e}"))
            return ctx, page

        def open_(page, hash_="#accueil", wait=VISIBLE):
            page.goto(BASE + hash_)
            page.wait_for_selector(wait)
            page.wait_for_timeout(500)

        def visible_path(page):
            return page.evaluate(f"document.querySelector('{VISIBLE}').dataset.path")

        def shot(page, name):
            page.screenshot(path=SHOTS / f"{name}.png")

        def no_overflow(page):
            return page.evaluate(f"""(() => {{ const el = document.querySelector('{VISIBLE}');
                return el.scrollWidth <= el.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }})()""")

        # ================================================================ 1. Welcome
        for scheme in ("light", "dark"):
            ctx, page = phone(f"welcome {scheme}", scheme=scheme, name=None, welcome=False, when="2026-11-07T10:30:00+01:00")
            open_(page, "#accueil", ".welcome")
            page.wait_for_selector(".wl-scene.is-ready")
            page.wait_for_timeout(1300)
            shot(page, f"01-bienvenue-{scheme}")
            if scheme == "light":
                text = norm(page.locator(".wl-intro").inner_text())
                check("welcome: title, sentence, button and note",
                      "Promo MAPST" in text and "Des leçons de 5 minutes sur tes cours" in text
                      and "Commencer" in text and "Appli non officielle, faite par un stagiaire." in text)
                check("welcome: the sun rises (its circles have the animation)", page.locator(".wl-scene .wl-sun").count() == 2)
                check("welcome: the sky goes under the clock, with a shade", page.locator(".wl-scene").bounding_box()["y"] == 0
                      and page.locator(".wl-shade").count() == 1)
                check("welcome: no tab bar", not page.locator(".tabbar").is_visible())
                check("welcome: the app behind it can't be reached", page.evaluate("document.getElementById('app').inert") is True)
            page.locator("[data-next]").click()
            page.wait_for_timeout(500)
            check(f"welcome ({scheme}): « On t’appelle comment ? »", "On t’appelle comment" in norm(page.locator(".wl-step:not([hidden])").inner_text()))
            if scheme == "light":
                page.go_back()                                   # the back button of Android
                page.wait_for_timeout(500)
                check("welcome: « back » goes to the step before", page.locator(".wl-intro:not([hidden])").count() == 1)
                page.locator("[data-next]").click()
                page.wait_for_timeout(500)
                page.locator(".wl-name").fill("Samantha-Louise de la Tour")    # 26 characters
                check("welcome: 20 characters at most", len(page.locator(".wl-name").input_value()) == 20)
                page.locator(".wl-name").fill("Sam")
            else:
                page.locator(".wl-name").fill("Sam")
            shot(page, f"02-prenom-{scheme}")
            page.locator(".wl-form [type=submit]").click()
            page.wait_for_timeout(500)
            # Phase 6: « Garde ta progression » (the account), then « Plus tard ».
            step = norm(page.locator(".wl-step:not([hidden])").inner_text())
            check(f"welcome ({scheme}): « Garde ta progression », with the two account buttons and « Plus tard »",
                  "Garde ta progression" in step
                  and "Avec un compte, tu retrouves tes XP sur un nouveau téléphone et tu peux poser tes questions à la promo." in step
                  and page.locator(".wl-step:not([hidden]) [data-account='creer']").inner_text().strip() == "Créer mon compte"
                  and page.locator(".wl-step:not([hidden]) [data-account='connecter']").inner_text().strip() == "J’ai déjà un compte"
                  and page.locator(".wl-step:not([hidden]) [data-later]").inner_text().strip() == "Plus tard")
            shot(page, f"02b-compte-{scheme}")
            page.locator("[data-later]").click()
            page.wait_for_timeout(500)
            check(f"welcome ({scheme}): install help in a browser (the same steps as the sheet), with « Plus tard »",
                  "Installe l’appli" in norm(page.locator(".wl-step:not([hidden])").inner_text())
                  and page.locator(".wl-step:not([hidden]) .steps li").count() >= 3
                  and page.locator("[data-done]").inner_text().strip() == "Plus tard")
            if scheme == "light":
                bar = page.locator(".wl-step:not([hidden]) .wl-head")
                check("welcome: the next steps have a coloured bar under the clock", bar.bounding_box()["y"] == 0
                      and "gradient" in bar.evaluate("e => getComputedStyle(e).backgroundImage"))
            shot(page, f"03-installer-{scheme}")
            page.locator("[data-done]").click()
            page.wait_for_timeout(900)
            check(f"welcome ({scheme}): then Accueil, « Bonjour Sam »", page.locator(".welcome").count() == 0
                  and norm(page.locator(".home__hello").inner_text()) == "Bonjour Sam")
            if scheme == "light":
                saved = page.evaluate("[localStorage.getItem('promo-mapst:prenom'), localStorage.getItem('promo-mapst:bienvenue')]")
                check("welcome: the name and « seen » are saved on the phone", saved == ['"Sam"', "true"])
                check("welcome: history cleaned (back does not reopen a step)", page.evaluate("history.state && history.state.level") == 0)
                page.reload()
                page.wait_for_timeout(700)
                check("welcome: only once", page.locator(".welcome").count() == 0)
            ctx.close()

        # « Passer »: no name, « Bonjour » alone, a person icon in the round button.
        ctx, page = phone("welcome skip", name=None, welcome=False)
        open_(page, "#accueil", ".welcome")
        page.locator("[data-next]").click()
        page.wait_for_timeout(400)
        page.locator("[data-skip]").click()
        page.wait_for_timeout(400)
        page.locator("[data-later]").click()
        page.wait_for_timeout(400)
        page.locator("[data-done]").click()
        page.wait_for_timeout(800)
        check("Passer: « Bonjour » alone", norm(page.locator(".home__hello").inner_text()) == "Bonjour")
        check("Passer: a person icon instead of the initial", page.locator(".home__me use").get_attribute("href") == "#i-person")
        ctx.close()

        # Phones that used the app before Phase 3 (progress saved) see the welcome once too.
        ctx, page = phone("old phone", name=None, welcome=False, storage={"promo-mapst:reviser": json.dumps({"v": 1, "xp": 40, "days": {}, "done": {}, "cards": {}})})
        open_(page, "#planning", ".welcome")
        check("a phone of Phase 2 also sees the welcome", page.locator(".welcome").count() == 1)
        ctx.close()

        # ================================================================ 2. Accueil
        def now_card(page):
            return norm(page.locator(f"{VISIBLE} .now").inner_text())

        ctx, page = phone("accueil saturday", when="2026-11-07T10:30:00+01:00")
        open_(page)
        page.wait_for_selector(".home__sky svg")
        page.wait_for_timeout(2300)                                   # the entrance is over
        shot(page, "04-accueil-samedi-light")
        card = now_card(page)
        check("Accueil, Saturday: « Week-end », « lundi 9:00 » and the next half-day",
              card.startswith("Week-end") and "lundi 9:00" in card and "Stage APEC · AnimaNice" in card and "Structures AnimaNice" in card)
        check("Accueil: « Bonjour Sam », each word in its own span", page.locator(".home__hello span").count() == 2
              and norm(page.locator(".home__hello").inner_text()) == "Bonjour Sam")
        check("Accueil: the date under the greeting", norm(page.locator(".home__date").inner_text()) == "Samedi 7 novembre")
        check("Accueil: nothing else (the sky, its shade, the top, the dock with two things)",
              page.locator(f"{VISIBLE} > *").count() == 4 and page.locator(f"{VISIBLE} .home__dock > *").count() == 2
              and page.locator(f"{VISIBLE} .ring, {VISIBLE} .chip, {VISIBLE} .gchip").count() == 0)
        check("Accueil never scrolls", page.evaluate(f"(() => {{ const e = document.querySelector('{VISIBLE}'); return getComputedStyle(e).overflowY === 'hidden' && e.scrollHeight <= e.clientHeight; }})()"))
        check("the tab bar has 4 tabs: Accueil, Cours, Réviser, Planning",
              [norm(t) for t in page.locator(".tab").all_inner_texts()] == ["Accueil", "Cours", "Réviser", "Planning"])
        check("the sky is inside the page, anchored at the bottom, with its moving parts",
              page.locator(".home__sky svg").get_attribute("preserveAspectRatio") == "xMidYMax slice"
              and page.locator(".home__sky svg .b-swell").count() >= 3 and page.locator(".home__sky svg .b-cloud").count() >= 1
              and page.locator(".home__sky svg .b-boat").count() == 1)
        moving = "(sel) => getComputedStyle(document.querySelector(sel)).animationName"
        check("the scene moves while Accueil is on screen (clouds, boat, sea)",
              page.evaluate(moving, ".home .b-cloud") == "drift" and page.evaluate(moving, ".home .b-boat") == "sail"
              and page.evaluate(moving, ".home .b-swell") == "swell")
        check("the opening class is removed after the entrance", page.locator(".home.is-opening").count() == 0)
        check("« le mot »: a fact (no line of the owner yet), its words one by one",
              norm(page.locator(".mot small").inner_text()) == "Le savais-tu ?" and page.locator(".mot .w").count() > 3)
        check("in a browser: the pill « Installer l’appli »", norm(page.locator(".install").inner_text()) == "Installer l’appli")
        check("the bottom of the dock stays above the tab bar",
              page.locator(".home__dock").bounding_box()["y"] + page.locator(".home__dock").bounding_box()["height"] <= page.locator(".tabbar").bounding_box()["y"])
        check("theme-color follows the sky (jour)", page.locator("meta[name=theme-color]").get_attribute("content") == "#3F86BD")
        first_line = norm(page.locator(".mot").inner_text())
        page.wait_for_timeout(7200)                                   # 9 s after it appeared
        check("« le mot » changes every 9 seconds", norm(page.locator(".mot").inner_text()) != first_line)
        page.locator(".tab[data-tab=cours]").click()
        page.wait_for_timeout(600)
        check("the scene stops when Accueil isn't the tab shown", page.locator(".home.is-on").count() == 0)
        page.locator(".tab[data-tab=accueil]").click()
        page.wait_for_timeout(600)
        check("… and starts again when you come back", page.locator(".home.is-on").count() == 1)
        fact_theme = page.locator(".mot").get_attribute("data-theme")
        page.locator(".mot").click()
        page.wait_for_timeout(1200)
        check("tapping a fact opens its theme in Réviser", bool(fact_theme) and visible_path(page) == f"reviser/{fact_theme}")
        ctx.close()

        ctx, page = phone("accueil class", when="2026-11-09T10:40:00+01:00")
        open_(page)
        page.wait_for_selector(".home__sky svg")
        page.wait_for_timeout(2300)
        shot(page, "05-accueil-en-cours-light")
        card = now_card(page)
        check("Accueil, during a class: « En ce moment » with the pulsing dot, « encore 1 h 20 »",
              card.startswith("En ce moment") and "encore 1 h 20" in card and page.locator(".now .pulse").count() == 1)
        check("… its title, its place, the bar with start and end times", "Stage APEC · AnimaNice" in card and "Structures AnimaNice" in card
              and page.locator(".now__bar i").count() == 1 and norm(page.locator(".now__times").inner_text()) == "9:00 12:00")
        check("… the dot and the bar take the category colour (olivier)", "cat-centre" in page.locator(".now").get_attribute("class")
              and page.evaluate("getComputedStyle(document.querySelector('.now__bar i')).backgroundColor") == "rgb(62, 151, 98)")
        check("Accueil, morning: the sky of the day (jour), navy text", page.locator(".home").get_attribute("data-ciel") == "jour"
              and page.evaluate("getComputedStyle(document.querySelector('.home__hello')).color") == "rgb(16, 53, 80)")
        page.locator(f"{VISIBLE} .now").click()
        page.wait_for_selector(".sheet-layer.is-open")
        page.wait_for_timeout(500)
        check("Accueil: the card opens the details of that half-day, with its address", "?seance=2026-11-09-am" in page.url
              and "Stage APEC · AnimaNice" in page.locator(".sheet").inner_text())
        check("details: « Voir le chapitre » under « Réviser ce thème »",
              [norm(t) for t in page.locator(".linked .btn").all_inner_texts()] == ["Réviser ce thème", "Voir le chapitre"])
        page.locator("[data-theme-id]").click()
        page.wait_for_timeout(1200)
        check("details: « Réviser ce thème » opens the theme in Réviser", visible_path(page) == "reviser/entretien-corporel"
              and page.locator(".tab[data-tab=reviser]").get_attribute("aria-selected") == "true")
        check("a theme's page: the row « Documents du chapitre » at the bottom", page.locator(f"{VISIBLE} .theme-docs [data-chapter]").count() == 1)
        page.locator(f"{VISIBLE} .theme-docs [data-chapter]").click()
        page.wait_for_timeout(1200)
        check("… it opens the chapter in Cours", visible_path(page) == "cours/entretien-corporel")
        page.goto(BASE + "#planning?seance=2026-11-09-am")
        page.wait_for_selector(".sheet-layer.is-open")
        page.wait_for_timeout(400)
        page.locator("[data-chapter-id]").click()
        page.wait_for_timeout(1200)
        check("details: « Voir le chapitre » opens the chapter in Cours", visible_path(page) == "cours/entretien-corporel")
        ctx.close()

        ctx, page = phone("accueil lunch", when="2026-11-09T12:20:00+01:00")
        open_(page)
        card = now_card(page)
        check("Accueil, lunch break: « Ensuite », « à 13:00 », no bar", card.startswith("Ensuite") and "à 13:00" in card
              and "Stage APEC · AnimaNice" in card and page.locator(".now__bar").count() == 0 and page.locator(".now .pulse").count() == 0)
        ctx.close()

        mots = {"about": "", "mots": [{"text": "On ne progresse pas en restant dans ce qu’on sait déjà faire."},
                                      {"text": "Une séance sans objectif, c’est une récréation.", "label": "Entendu en cours", "by": "Y.S."}]}
        ctx, page = phone("accueil evening dark", when="2026-11-24T21:30:00+01:00", scheme="dark", content={"mots.json": mots})
        open_(page)
        page.wait_for_selector(".home__sky svg")
        page.wait_for_timeout(2300)
        shot(page, "06-accueil-soir-dark")
        card = now_card(page)
        check("Accueil, evening: « Fini pour aujourd’hui », « demain 8:30 », the next half-day",
              card.startswith("Fini pour aujourd’hui") and "demain 8:30" in card and "Mercredi au centre de loisirs" in card)
        check("Accueil, evening: « Bonsoir Sam » on the night sky, in white",
              norm(page.locator(".home__hello").inner_text()) == "Bonsoir Sam" and page.locator(".home").get_attribute("data-ciel") == "nuit"
              and page.evaluate("getComputedStyle(document.querySelector('.home__hello')).color") == "rgb(255, 255, 255)")
        check("at night the tab bar turns to dark glass", page.evaluate("getComputedStyle(document.querySelector('.tab.is-on')).color") == "rgb(255, 210, 138)")
        check("theme-color follows the sky (nuit)", page.locator("meta[name=theme-color]").get_attribute("content") == "#0A1C30")
        check("with lines of the owner: « le mot » starts with one, « Le mot du jour » by default",
              norm(page.locator(".mot small").inner_text()) in ("Le mot du jour", "Entendu en cours · Y.S.") and not page.locator(".mot").get_attribute("data-theme"))
        seen = [norm(page.locator(".mot small").inner_text())]
        for _ in range(3):
            page.wait_for_timeout(9000)
            seen.append(norm(page.locator(".mot small").inner_text()))
        check("… then one mot, one fact, and so on", seen[1] == "Le savais-tu ?" and seen[3] == "Le savais-tu ?"
              and {seen[0], seen[2]} == {"Le mot du jour", "Entendu en cours · Y.S."})
        if not (seen[1] == "Le savais-tu ?" and seen[3] == "Le savais-tu ?"):
            print("   mots:", seen)
        ctx.close()

        ctx, page = phone("accueil holiday", when="2026-11-11T10:00:00+01:00")
        open_(page)
        card = now_card(page)
        check("Accueil, 11 November: the holiday's name, « demain 9:00 »", card.startswith("Armistice") and "demain 9:00" in card)
        ctx.close()

        ctx, page = phone("accueil christmas", when="2026-12-23T10:00:00+01:00")
        open_(page)
        card = now_card(page)
        check("Accueil, Christmas holidays: « Vacances de Noël » and the next class in January",
              card.startswith("Vacances de Noël") and "4 janv. 9:00" in card)
        ctx.close()

        events = [{"id": "e1", "title": "Footing", "date": "2027-03-05", "allDay": False, "start": "18:00", "end": "19:00", "repeat": "none", "place": "", "note": ""},
                  {"id": "e2", "title": "Dentiste", "date": "2027-03-05", "allDay": False, "start": "19:30", "end": "20:00", "repeat": "none", "place": "", "note": ""}]
        ctx, page = phone("accueil deadline", when="2027-03-05T08:00:00+01:00", storage={"promo-mapst:events": json.dumps(events)})
        open_(page)
        page.wait_for_timeout(2300)
        shot(page, "07-accueil-dossier-light")
        check("Accueil: one extra line, the dossier due within 14 days first, with its J-x",
              page.locator(".now__extra").count() == 1 and norm(page.locator(".now__extra").inner_text()) == "Dossier BC3 à rendre · J-10")
        ctx.close()
        ctx, page = phone("accueil personal", when="2027-01-12T08:00:00+01:00",
                          storage={"promo-mapst:events": json.dumps([dict(e, date="2027-01-12") for e in events])})
        open_(page)
        check("Accueil: else today's personal event, and « +1 » when there are more",
              norm(page.locator(".now__extra").inner_text()) == "Aussi aujourd’hui : Footing, 18:00 +1")
        ctx.close()

        # Installed (opened from the home screen): no « Installer l'appli » anywhere.
        ctx, page = phone("installed")
        ctx.add_init_script("Object.defineProperty(navigator, 'standalone', { get: () => true });")
        open_(page)
        check("installed: no pill on Accueil", page.locator(".install").count() == 0 and page.locator(".app.is-installed").count() == 1)
        page.locator(".home__me").click()
        page.wait_for_timeout(700)
        check("installed: no « Installer l’appli » in Profil", page.locator("[data-install]").count() == 0)
        ctx.close()

        # The four skies, forced in the address (light and dark); and the real sky at four moments.
        for sky, top in (("aube", "#7E9EC4"), ("jour", "#3F86BD"), ("couchant", "#4A3A80"), ("nuit", "#0A1C30")):
            for scheme in ("light", "dark"):
                ctx, page = phone(f"sky {sky} {scheme}", when="2026-11-09T12:00:00+01:00", scheme=scheme)
                open_(page, f"#accueil?ciel={sky}")
                page.wait_for_selector(".home__sky svg")
                page.wait_for_timeout(2300)
                if scheme == "light":
                    check(f"#accueil?ciel={sky} shows that sky, and theme-color {top}", page.locator(".home").get_attribute("data-ciel") == sky
                          and page.locator(f".home__sky svg #{sky}-sky").count() == 1
                          and page.locator("meta[name=theme-color]").get_attribute("content") == top)
                    white = sky in ("couchant", "nuit")
                    check(f"text on the sky at {sky}: {'white' if white else 'navy'}",
                          page.evaluate("getComputedStyle(document.querySelector('.home__hello')).color") == ("rgb(255, 255, 255)" if white else "rgb(16, 53, 80)"))
                shot(page, f"08-ciel-{sky}-{scheme}")
                ctx.close()
        ctx, page = phone("sky change", when="2026-11-09T12:00:00+01:00")
        open_(page)
        page.wait_for_selector(".home__sky svg")
        page.goto(BASE + "#accueil?ciel=nuit")
        page.wait_for_timeout(300)
        check("the sky changes while the app is open: the old one fades over the new one", page.locator(".home__sky svg").count() == 2
              and page.locator(".home__sky svg.old").count() == 1)
        page.wait_for_timeout(1200)
        check("… and is removed after the cross-fade", page.locator(".home__sky svg").count() == 1 and page.locator(".home__sky svg #nuit-sky").count() == 1)
        ctx.close()
        skies = {}
        for moment in ("07:30", "12:00", "16:30", "20:00"):
            ctx, page = phone(f"real sky {moment}", when=f"2026-11-09T{moment}:00+01:00")
            open_(page)
            skies[moment] = page.locator(".home").get_attribute("data-ciel")
            ctx.close()
        check("the sky follows the sun of Nice (dawn, day, sunset, night)",
              skies == {"07:30": "aube", "12:00": "jour", "16:30": "couchant", "20:00": "nuit"})
        if skies != {"07:30": "aube", "12:00": "jour", "16:30": "couchant", "20:00": "nuit"}:
            print("   skies:", skies)
        computed = subprocess.run(["node", "-e", """
            import('./js/core/sun.js').then(({ sunTimes }) => {
              const f = (d) => d.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
              const t = sunTimes(new Date('2026-12-21T12:00:00+01:00'));
              console.log(f(t.sunrise) + ' ' + f(t.sunset));
            });"""], cwd=REPO, capture_output=True, text=True).stdout.strip()
        check("sunrise and sunset of Nice on 21 December (≈ 8:00 and 16:56)", computed in ("07:59 16:56", "08:00 16:56", "08:01 16:56", "08:01 16:55", "08:00 16:57"))

        # ================================================================ 3. Getting around
        ctx, page = phone("navigation", when="2026-11-07T10:30:00+01:00")
        open_(page)
        page.locator(".home__me").click()
        page.wait_for_timeout(700)
        check("the round initial opens Profil (#accueil/profil)", visible_path(page) == "accueil/profil" and page.url.endswith("#accueil/profil"))
        check("a page opened from another has « ‹ Accueil »", norm(page.locator(f"{VISIBLE} .back").inner_text()) == "Accueil")
        page.locator(f"{VISIBLE} .back").click()
        page.wait_for_timeout(700)
        check("« ‹ » goes back", visible_path(page) == "accueil" and page.url.endswith("#accueil"))
        page.locator(".home__me").click()
        page.wait_for_timeout(700)
        swipe(page, 6, 330, 500)
        page.wait_for_timeout(900)
        check("a swipe from the left edge goes back", visible_path(page) == "accueil")
        # Changing tab: the new one comes from the side of its tab, the lens slides under its icon.
        page.locator(".tab[data-tab=planning]").click()
        page.wait_for_timeout(60)
        going = page.evaluate("[...document.querySelectorAll('.panel')].map((p) => [p.dataset.tab, p.className, p.style.getPropertyValue('--dir')])")
        check("to a tab further right: it enters from the right (--dir: 1), the old one leaves",
              any(t == "planning" and "is-entering" in c and d == "1" for t, c, d in going)
              and any(t == "accueil" and "is-leaving" in c for t, c, d in going))
        page.wait_for_timeout(1000)
        check("… then only the new tab is left, and the lens is under the 4th icon",
              page.locator(".panel:not([hidden])").count() == 1 and page.locator(".panel.is-entering, .panel.is-leaving").count() == 0
              and page.evaluate("document.querySelector('.tabbar').style.getPropertyValue('--at')") == "3"
              and page.locator(".tab.is-on").get_attribute("data-tab") == "planning")
        check("the first blocks of a tab's first screen rise one after the other", page.locator(f"{VISIBLE} .rise").count() >= 4)
        page.locator(".tab[data-tab=cours]").click()
        page.wait_for_timeout(60)
        check("to a tab further left: it enters from the left (--dir: -1)",
              page.evaluate("document.querySelector('.panel[data-tab=cours]').style.getPropertyValue('--dir')") == "-1")
        page.wait_for_timeout(600)
        check("theme-color follows the tab (Cours)", page.locator("meta[name=theme-color]").get_attribute("content").upper() == "#5140CC")
        page.locator(".tab[data-tab=reviser]").click()
        page.wait_for_timeout(500)
        page.locator(f"{VISIBLE} [data-theme=publics]").click()
        page.wait_for_timeout(700)
        page.locator(".tab[data-tab=planning]").click()
        page.wait_for_timeout(400)
        page.locator(f"{VISIBLE} [data-dates-cles]").click()
        page.wait_for_timeout(700)
        page.locator(".tab[data-tab=reviser]").click()
        page.wait_for_timeout(500)
        check("each tab remembers where you were (Réviser: the theme)", visible_path(page) == "reviser/publics")
        bar = page.locator(f"{VISIBLE} .topbar--page")
        check("a page opened from a tab: a small bar in the gradient of its tab, under the clock",
              bar.bounding_box()["y"] == 0 and "gradient" in bar.evaluate("e => getComputedStyle(e).backgroundImage")
              and bar.evaluate("e => getComputedStyle(e).color") == "rgb(255, 255, 255)")
        page.locator(".tab[data-tab=reviser]").click()
        page.wait_for_timeout(800)
        check("tapping the current tab again: back to its first page", visible_path(page) == "reviser")
        page.go_back()
        page.wait_for_timeout(700)
        check("back (Android) from Réviser's first page: Accueil", visible_path(page) == "accueil"
              and page.locator(".tab[data-tab=accueil]").get_attribute("aria-selected") == "true")
        page.locator(".tab[data-tab=planning]").click()
        page.wait_for_timeout(500)
        check("Planning remembers « Dates clés »", visible_path(page) == "planning/dates-cles")
        page.go_back()
        page.wait_for_timeout(700)
        page.go_back()
        page.wait_for_timeout(700)
        check("back twice: Dates clés, Planning, then Accueil", visible_path(page) == "accueil")
        # Sheets: ×, back, a tap outside, a swipe down.
        page.locator(".tab[data-tab=planning]").click()
        page.wait_for_timeout(500)
        page.locator(".gseg__btn[data-view=mois]").click()
        page.wait_for_timeout(400)
        def open_legend():
            page.locator(f"{VISIBLE} [data-legend]").click()
            page.wait_for_selector(".sheet-layer.is-open")
            page.wait_for_timeout(500)
        open_legend()
        check("« Couleurs » opens the legend, with its address", "?couleurs" in page.url and "Lavande · Préparation" in norm(page.locator(".sheet").inner_text()))
        page.locator(".sheet [data-sheet-close]").click()
        page.wait_for_timeout(700)
        check("a sheet closes with ×", page.locator(".sheet-layer").count() == 0 and "?couleurs" not in page.url)
        open_legend()
        page.go_back()
        page.wait_for_timeout(700)
        check("a sheet closes with back", page.locator(".sheet-layer").count() == 0 and visible_path(page) == "planning")
        open_legend()
        page.mouse.click(195, 40)
        page.wait_for_timeout(700)
        check("a sheet closes with a tap outside", page.locator(".sheet-layer").count() == 0)
        open_legend()
        box = page.locator(".sheet__grabber").bounding_box()
        page.mouse.move(box["x"] + 19, box["y"] + 2)
        page.mouse.down()
        page.mouse.move(box["x"] + 19, box["y"] + 260, steps=8)
        page.mouse.up()
        page.wait_for_timeout(800)
        check("a sheet closes with a swipe down", page.locator(".sheet-layer").count() == 0)
        page.locator(".gseg__btn[data-view=semaine]").click()
        page.wait_for_timeout(400)
        # Old addresses, and addresses opened directly.
        page.goto(BASE + "#infos")
        page.wait_for_timeout(700)
        check("old #infos opens Profil", visible_path(page) == "accueil/profil" and page.url.endswith("#accueil/profil"))
        page.goto(BASE + "#etudier")
        page.wait_for_timeout(700)
        check("old #etudier opens Cours", visible_path(page) == "cours")
        for address, expect in (("#planning/dates-cles", "planning/dates-cles"), ("#reviser/fiche-de-seance", "reviser/fiche-de-seance"),
                                ("#cours/publics", "cours/publics"), ("#accueil/profil/donnees", "accueil/profil/donnees")):
            page.goto(BASE + address)
            page.reload()
            page.wait_for_timeout(800)
            check(f"opened on {address}", visible_path(page) == expect)
        page.go_back()
        page.wait_for_timeout(700)
        check("opened on a deep address, back goes to its parent", visible_path(page) == "accueil/profil")
        page.goto(BASE + "#planning?seance=2026-11-09-am")
        page.wait_for_timeout(600)
        check("a sheet's address typed in the open app: the sheet opens", page.locator(".sheet-layer.is-open").count() == 1)
        page.reload()
        page.wait_for_selector(".sheet-layer.is-open")
        check("opened on a sheet's address: the sheet opens", "Stage APEC · AnimaNice" in page.locator(".sheet").inner_text())
        page.go_back()
        page.wait_for_timeout(700)
        check("… and back closes it, on its page", page.locator(".sheet-layer").count() == 0 and visible_path(page) == "planning")
        ctx.close()

        # ================================================================ 4. Planning
        ctx, page = phone("planning", when="2026-11-07T10:30:00+01:00")
        open_(page, "#planning")
        shot(page, "09-planning-semaine-light")
        check("Planning opens on Semaine, today selected (Saturday 7)",
              page.locator(".gseg__btn[aria-checked=true]").inner_text().strip() == "Semaine"
              and page.locator(".dcard.on b").inner_text() == "7" and "2 – 8 novembre" in norm(page.locator(".weekhead").inner_text()))
        check("the header: « Planning », « Aujourd’hui », « + », on the azur gradient under the clock",
              page.locator(f"{VISIBLE} .hd.hd--lift").bounding_box()["y"] == 0 and page.locator(".hd [data-today].gchip").count() == 1
              and page.locator(".hd [data-add-event].gbtn").count() == 1)
        check("a day without class says so in one card, with a link to the next class day",
              "Week-end, pas de formation." in norm(page.locator(".card.pl-empty").inner_text()) and "lundi 9 novembre" in norm(page.locator(".pl-empty__link").inner_text()))
        cards = page.locator(".dcard")
        check("the strip: one card per day, with « lun. », the date, a label and two bars",
              cards.count() == 7 and norm(cards.nth(0).inner_text()) == "lun. 2 Stage APEC" and cards.nth(0).locator(".halves i").count() == 2)
        check("days without class are off, with « Repos » on a week-end", "off" in cards.nth(5).get_attribute("class").split()
              and norm(cards.nth(5).inner_text()) == "sam. 7 Repos" and cards.nth(6).locator(".halves i").count() == 0)
        box = page.locator(".dcard.on").bounding_box()
        check("the chosen day is brought towards the middle of the strip (the strip slides sideways)",
              page.evaluate("document.querySelector('.days').scrollLeft") > 100 and box["x"] + box["width"] <= 390)
        check("no « Couleurs » chip in Semaine", page.locator(f"{VISIBLE} [data-legend]").count() == 0)
        check("the correction of 2–20 November shows as a citron banner", "Du 2 au 20 novembre" in norm(page.locator(".pl-banner").first.inner_text()))
        page.locator(".pl-empty__link").click()
        page.wait_for_timeout(500)
        check("the link opens the next class day (week of 9–15 November)", "9 – 15 novembre" in norm(page.locator(".weekhead").inner_text())
              and norm(page.locator(".dayhead").inner_text()).startswith("Lundi 9 novembre"))
        check("the half-days are cards (time, colour bar, title, place)", page.locator(".pl-day .slots .slot").count() == 2
              and page.locator(".slot .slot__when").count() == 2 and page.locator(".slot .slot-bar").count() == 2)
        check("the order of Semaine: the strip, the title, the half-days, the banner, then Dates clés",
              page.evaluate("(() => { const y = (s) => document.querySelector(s).getBoundingClientRect().top; return y('.days') < y('.dayhead') && y('.dayhead') < y('.pl-daylist') && y('.pl-daylist') < y('.pl-banner') && y('.pl-banner') < y('[data-dates-cles]') && y('[data-dates-cles]') < y('[data-export]'); })()"))
        rows = norm(page.locator(".pl-day").inner_text())
        check("a day: hours, title, place and who", "9:00" in rows and "12:00" in rows and "Stage APEC · AnimaNice" in rows and "Structures AnimaNice, Ville de Nice" in rows)
        banners = norm(" ".join(page.locator(".pl-banner").all_inner_texts()))
        check("the note of 11 November shows in its week", "Mercredi 11 novembre" in banners and "Du 2 au 20 novembre" in banners)
        shot(page, "10-planning-semaine-9-light")
        check("11 November on its card: « Férié », off", norm(page.locator(".dcard").nth(2).inner_text()) == "mer. 11 Férié")
        page.locator(".dcard").nth(2).click()
        page.wait_for_timeout(400)
        check("Wednesday 11: the holiday", "Armistice, férié" in norm(page.locator(".pl-day").inner_text()))
        page.locator(".arrow[data-step='1']").click()
        page.wait_for_timeout(400)
        check("the arrow: next week, same day", "16 – 22 novembre" in norm(page.locator(".weekhead").inner_text()) and page.locator(".dcard.on b").inner_text() == "18")
        page.locator(".arrow[data-step='1']").click()
        page.wait_for_timeout(400)
        check("the arrow again: the week after", "23 – 29 novembre" in norm(page.locator(".weekhead").inner_text()))
        check("no APEC banner after 20 November", "Du 2 au 20 novembre" not in norm(page.locator(".pl-view").inner_text()))
        day_list = page.locator(".pl-daylist").bounding_box()
        swipe(page, day_list["x"] + 80, day_list["x"] + 300, day_list["y"] + 30)
        page.wait_for_timeout(500)
        check("a swipe on the list: the day before", norm(page.locator(".dayhead").inner_text()).startswith("Mardi 24 novembre"))
        # « À vérifier » on a half-day with a note (place not given in the official planning).
        checked = next(k for k, d in sorted(PLANNING["days"].items()) if k >= "2026-11-07" and any(s.get("check") for s in d.get("slots", [])))
        page.goto(BASE + f"#planning?seance={checked}-{next(s['half'] for s in PLANNING['days'][checked]['slots'] if s.get('check'))}")
        page.wait_for_selector(".sheet-layer.is-open")            # (a reload in the same instant would race with it)
        page.reload()
        page.wait_for_selector(".sheet-layer.is-open")
        check(f"details of a half-day to check: its « À vérifier » note ({checked})", "À vérifier." in page.locator(".sheet").inner_text())
        shot(page, "11-details-a-verifier-light")
        page.go_back()
        page.wait_for_timeout(600)
        check("… and a small « À vérifier » tag in its day", page.locator(".pl-day .tag.tone-citron").count() >= 1)
        # The half-day that is on now: « En cours », how long is left, a thin progress bar.
        ctx2, page2 = phone("planning now", when="2026-11-12T13:45:00+01:00")
        open_(page2, "#planning")
        now = page2.locator(".slot.is-now")
        check("the half-day that is on: « En cours », « encore 2 h 15 » and a progress bar", now.count() == 1
              and "En cours" in norm(now.inner_text()) and "encore 2 h 15" in norm(now.inner_text()) and now.locator(".slot__bar i").count() == 1)
        check("today's title: « Aujourd’hui » with the date small on the right", norm(page2.locator(".dayhead").inner_text()) == "Aujourd’hui jeudi 12 novembre")
        shot(page2, "09b-planning-en-cours-light")
        page2.locator(f"{VISIBLE}").evaluate("e => e.scrollTo(0, 400)")
        page2.wait_for_timeout(500)
        check("once the header has scrolled away, a small coloured bar stays at the top",
              page2.locator(f"{VISIBLE} .topbar.is-on").count() == 1 and page2.locator(f"{VISIBLE} .topbar").bounding_box()["y"] == 0)
        ctx2.close()
        # Mois and Année
        page.locator(".gseg__btn[data-view=mois]").click()
        page.wait_for_timeout(500)
        shot(page, "12-planning-mois-light")
        check("Mois: a calendar of the month", page.locator(".mday:not(.mday--blank)").count() == 30 and "Novembre 2026" in page.locator(".weekhead").inner_text())
        check("Mois: the calendar is a white card that straddles the header",
              page.locator(".body.body--lift").count() == 1 and page.locator(".month").bounding_box()["y"] < page.locator(".hd").bounding_box()["height"])
        check("Mois: « Couleurs » as a small chip above the grid", page.locator(".month [data-legend]").count() == 1
              and page.locator(".month [data-legend]").bounding_box()["y"] < page.locator(".month__grid").bounding_box()["y"])
        page.locator(".mday", has_text="10").first.click()
        page.wait_for_timeout(400)
        check("Mois: a tapped day shows its half-days", norm(page.locator(".dayhead").inner_text()).startswith("Mardi 10 novembre")
              and "Stage APEC" in page.locator(".pl-daylist").inner_text())
        page.locator(".arrow[data-step='1']").click()
        page.wait_for_timeout(400)
        check("Mois: the arrow, next month", "Décembre 2026" in page.locator(".weekhead").inner_text())
        page.locator(".gseg__btn[data-view=annee]").click()
        page.wait_for_timeout(600)
        shot(page, "13-planning-annee-light")
        check("Année: September to June", page.locator(".ymonth").count() == 10)
        check("Année: « 2026 – 2027 », nothing straddles, « Couleurs » above the grid", "2026 – 2027" in norm(page.locator(".weekhead").inner_text())
              and page.locator(".hd.hd--lift").count() == 0 and page.locator(".year__top [data-legend]").count() == 1)
        check("Année: the stages of the year", page.locator(".stage").count() == len(PLANNING["stages"]))
        days = page.evaluate("""[...document.querySelectorAll('.yday:not(.yday--blank)')].map(b => {
            const cs = getComputedStyle(b); const r = b.getBoundingClientRect();
            return { iso: b.dataset.gotoWeek, text: b.textContent.trim(), w: r.width, h: r.height, size: cs.fontSize, weight: cs.fontWeight,
                     num: cs.fontVariantNumeric, color: cs.color, cls: b.className, shadow: cs.boxShadow }; })""")
        check("Année: every day shows its date number inside its dot",
              len(days) == 303 and all(d["text"] == str(int(d["iso"][8:])) for d in days))
        check("Année: the numbers are 10 px, weight 700, tabular figures",
              all(d["size"] == "10px" and d["weight"] == "700" and "tabular-nums" in d["num"] for d in days))
        check("Année: round dots of 22 px at least, as large as the month allows",
              min(d["w"] for d in days) >= 22 and all(abs(d["w"] - d["h"]) < .5 for d in days)
              and page.evaluate("getComputedStyle(document.querySelector('.yday')).borderRadius") == "50%")
        filled = [d for d in days if "cat-cours" in d["cls"]]
        pale = [d for d in days if "is-empty" in d["cls"] or "cat-libre" in d["cls"]]
        check("Année: white numbers (--on-accent) on filled colours, --ink-2 on pale or empty days",
              filled and pale and all(d["color"] == "rgb(255, 255, 255)" for d in filled) and all(d["color"] == "rgb(79, 102, 128)" for d in pale))
        check("Année: today keeps its ring", [d["iso"] for d in days if "is-today" in d["cls"]] == ["2026-11-07"]
              and "rgb(16, 112, 176)" in next(d["shadow"] for d in days if "is-today" in d["cls"]))
        check("Année: no sideways scrolling", no_overflow(page))
        page.locator(".ymonth").nth(4).locator(".ymonth__head").click()      # January
        page.wait_for_timeout(500)
        check("Année: a month opens Mois", page.locator(".gseg__btn[aria-checked=true]").inner_text().strip() == "Mois" and "Janvier 2027" in page.locator(".weekhead").inner_text())
        page.locator(".gseg__btn[data-view=annee]").click()
        page.wait_for_timeout(500)
        page.locator(".yday[data-goto-week='2027-02-03']").click()
        page.wait_for_timeout(500)
        check("Année: a day opens its week", page.locator(".gseg__btn[aria-checked=true]").inner_text().strip() == "Semaine"
              and norm(page.locator(".dayhead").inner_text()).startswith("Mercredi 3 février"))
        page.locator("[data-today]").click()
        page.wait_for_timeout(500)
        check("« Aujourd’hui » comes back to today", page.locator(".dcard.on b").inner_text() == "7")
        # Dates clés
        page.locator(f"{VISIBLE} [data-dates-cles]").click()
        page.wait_for_timeout(800)
        shot(page, "14-dates-cles-light")
        text = norm(page.locator(f"{VISIBLE}").inner_text())
        check("Dates clés: by month, with J-x on épreuves and dossiers and « À confirmer »",
              "Novembre" in text and "Armistice, férié" in text and "Dossier BC3 à rendre" in text and "J‑128" in text and "À confirmer" in text)
        check("Dates clés: « Retour au CAL » with its detail under it", "Retour au CAL" in text and "Environnement, puis APEN" in text)
        page.locator("[data-filter=examens]").click()
        page.wait_for_timeout(400)
        text = norm(page.locator(f"{VISIBLE}").inner_text())
        check("Dates clés: « Épreuves et dossiers » only", "Armistice" not in text and "Dossier BC3 à rendre" in text)
        page.locator(f"{VISIBLE} [data-goto-day='2027-03-15']").first.click()
        page.wait_for_timeout(900)
        check("Dates clés: a date opens the planning on that day", visible_path(page) == "planning"
              and norm(page.locator(".dayhead").inner_text()).startswith("Lundi 15 mars"))
        # A personal event
        page.locator("[data-add-event]").click()
        page.wait_for_selector(".sheet-layer.is-open [name=ev-title]")
        check("« + » opens the form (?evenement=nouveau)", "?evenement=nouveau" in page.url)
        page.locator("[name=ev-title]").fill("Révisions en groupe")
        page.locator("[name=ev-date]").fill("2026-11-09")
        page.locator("[name=ev-start]").fill("17:30")
        page.locator(".ev-form [type=submit]").click()
        page.wait_for_timeout(700)
        page.locator("[data-today]").click()
        page.wait_for_timeout(300)
        page.locator(".pl-empty__link").click()
        page.wait_for_timeout(500)
        check("the personal event shows in its day, in citron", "Révisions en groupe" in page.locator(".pl-day").inner_text()
              and page.locator(".slot.cat-perso").count() == 1)
        page.locator(f"{VISIBLE} [data-export]").click()
        page.wait_for_selector(".sheet-layer.is-open")
        check("« Ajouter à ton agenda »: the calendar options", "Google Agenda" in page.locator(".sheet").inner_text() and "?agenda" in page.url)
        ctx.close()

        # ================================================================ 5. Profil
        ctx, page = phone("profil", when="2026-11-07T10:30:00+01:00",
                          storage={"promo-mapst:reviser": json.dumps({"v": 1, "xp": 30, "days": {}, "done": {}, "cards": {}})})
        open_(page, "#accueil/profil")
        shot(page, "15-profil-light")
        text = norm(page.locator(f"{VISIBLE}").inner_text())
        check("Profil: the name and « Changer mon prénom »", "Sam" in text and "Changer mon prénom" in text)
        check("Profil: « Mode relecture » off, with its line", "Pour vérifier les questions et signaler les erreurs." in text
              and not page.locator("[data-relecture]").is_checked() and page.locator("[data-report]").count() == 0)
        check("Profil: « Installer l’appli » in a browser", "Installer l’appli" in text)
        check("Profil: « À propos du planning » with the version and the correction",
              "Version du 1er octobre, corrigée le 7 novembre" in text)
        check("Profil: a small amber bar under the clock, with « ‹ Accueil »",
              page.locator(f"{VISIBLE} .topbar--page").bounding_box()["y"] == 0
              and page.evaluate("getComputedStyle(document.querySelector('.panel.is-on .topbar--page')).backgroundImage").startswith("linear-gradient(168deg, rgb(138, 75, 0)"))
        check("Profil: the footer text", "Application non officielle créée par un stagiaire. En cas de doute, vérifie dans tes cours." in text)
        page.locator("[data-name]").click()
        page.wait_for_selector(".sheet-layer.is-open input")
        page.locator(".sheet input").fill("Alex")
        page.locator(".sheet [type=submit]").click()
        page.wait_for_timeout(700)
        check("Changer mon prénom: Profil follows", norm(page.locator(f"{VISIBLE} .me-big h1").inner_text()) == "Alex")
        page.locator(f"{VISIBLE} .back").click()
        page.wait_for_timeout(700)
        check("… and Accueil too", norm(page.locator(".home__hello").inner_text()) == "Bonjour Alex" and page.locator(".home__me").inner_text().strip() == "A")
        page.locator(".home__me").click()
        page.wait_for_timeout(700)
        page.locator("[data-relecture]").check()
        page.wait_for_timeout(500)
        check("Relecture on: « Rapport de relecture » appears under it", page.locator("[data-report]").count() == 1)
        page.locator("[data-report]").click()
        page.wait_for_timeout(700)
        check("Rapport de relecture: a page with « ‹ Profil »", visible_path(page) == "accueil/profil/relecture" and norm(page.locator(f"{VISIBLE} .back").inner_text()) == "Profil")
        shot(page, "16-rapport-light")
        page.locator(f"{VISIBLE} .back").click()
        page.wait_for_timeout(700)
        page.locator("[data-relecture]").uncheck()
        page.wait_for_timeout(400)
        page.locator("[data-about]").click()
        page.wait_for_timeout(700)
        text = norm(page.locator(f"{VISIBLE}").inner_text())
        check("À propos du planning: source, corrections and the notes without a date",
              "Version du 1er octobre 2026" in text and "Le 7 novembre 2026" in text and "Du 2 au 20 novembre" in text
              and "Semaine du 7 décembre" in text and "Lieux non précisés" in text)
        shot(page, "17-a-propos-light")
        page.locator(f"{VISIBLE} .back").click()
        page.wait_for_timeout(700)
        page.locator("[data-stored]").click()
        page.wait_for_timeout(700)
        text = norm(page.locator(f"{VISIBLE}").inner_text())
        check("Ce que l’appli garde: the list, and nothing sent elsewhere without an account", "Ton prénom" in text and "« Alex »" in text
              and "Sans compte, rien n’est envoyé ailleurs" in text and "Google Firebase" in text)
        reset = page.locator("[data-reset]")
        reset.click()
        armed = "Touche encore" in reset.inner_text()
        reset.click()
        page.wait_for_timeout(400)
        check("« Effacer ma progression »: two taps", armed and page.evaluate("localStorage.getItem('promo-mapst:reviser')") is None)
        page.go_back()
        page.wait_for_timeout(600)
        page.locator(f"{VISIBLE} [data-install]").click()
        page.wait_for_selector(".sheet-layer.is-open")
        check("Installer l’appli: the steps in a sheet", "?installer" in page.url and "Installer l’appli" in page.locator(".sheet").inner_text()
              and page.locator(".sheet .steps li").count() >= 3)
        page.go_back()
        page.wait_for_timeout(600)
        page.locator(f"{VISIBLE} [data-welcome]").click()
        page.wait_for_selector(".welcome")
        page.wait_for_timeout(500)
        check("« Revoir la bienvenue » shows the welcome again", page.locator(".wl-intro:not([hidden])").count() == 1)
        page.locator("[data-next]").click()
        page.wait_for_timeout(400)
        check("… with the saved name in the field", page.locator(".wl-name").input_value() == "Alex")
        page.locator("[data-skip]").click()
        page.wait_for_timeout(400)
        page.locator("[data-later]").click()
        page.wait_for_timeout(400)
        page.locator("[data-done]").click()
        page.wait_for_timeout(800)
        check("… « Passer » keeps the name, and it comes back to Profil",
              page.locator(".welcome").count() == 0 and visible_path(page) == "accueil/profil"
              and norm(page.locator(f"{VISIBLE} .me-big h1").inner_text()) == "Alex")
        ctx.close()

        # ================================================================ 6. Cours
        PARCOURS = json.loads((REPO / "content/parcours.json").read_text(encoding="utf-8"))
        CHAPTERS = PARCOURS["chapitres"]
        LECONS = json.loads((REPO / "content/lecons/index.json").read_text(encoding="utf-8"))["lecons"]
        with_lessons = {l["chapitre"] for l in LECONS}
        ctx, page = phone("cours", when="2026-11-16T13:45:00+01:00")
        open_(page, "#cours")
        shot(page, "21-cours-light")
        text = norm(page.locator(f"{VISIBLE} .hd").inner_text())
        check("Cours: the header with « Cours » and its sentence",
              "Cours" in text and "Le programme dans l’ordre de l’année. Chaque étape a ses leçons et son quiz." in text)
        check("Cours: a glass card opens the first lesson to read, « Commencer · 5 min »",
              norm(page.locator(f"{VISIBLE} .hd .gcard").inner_text()) == f"{LECONS[0]['title']} Commencer · 5 min"
              and page.locator(f"{VISIBLE} .hd .gcard").get_attribute("data-lecon") == LECONS[0]["id"])
        check("Cours: the chips « Tout », then every bloc of parcours.json (4)",
              [norm(t) for t in page.locator(".filters__chip").all_inner_texts()] == ["Tout"] + [b["short"] for b in PARCOURS["blocs"]]
              and len(PARCOURS["blocs"]) == 4 and page.locator(".filters__chip[aria-checked=true]").inner_text().strip() == "Tout")
        chaps = page.locator(f"{VISIBLE} .chap")
        check("Cours: every chapter of parcours.json (19), in the order of the year, numbered", chaps.count() == len(CHAPTERS) == 19
              and [norm(t) for t in page.locator(".chap__n").all_inner_texts()] == [str(i + 1) for i in range(len(CHAPTERS))])
        first = norm(chaps.nth(0).inner_text())
        check("a chapter with a lesson and a quiz: « Septembre · BC3 », title, résumé, « 1 leçon », then « Quiz »",
              first == "1 Septembre · BC3 La fiche de séance Construire une séance, de l’objectif au bilan. 1 leçon Quiz"
              and chaps.nth(0).locator(".pill").first.inner_text().strip() == "1 leçon")
        check("a chapter with nothing yet: washed out (.6) with one grey pill « Bientôt »",
              "is-empty" in chaps.nth(1).get_attribute("class") and norm(chaps.nth(1).locator(".chap__acts").inner_text()) == "Bientôt"
              and page.evaluate(f"getComputedStyle(document.querySelectorAll('{VISIBLE} .chap')[1].querySelector('.chap__n')).opacity") == "0.6"
              and page.evaluate(f"getComputedStyle(document.querySelectorAll('{VISIBLE} .chap')[1].querySelector('.chap__title')).opacity") == "0.6")
        # (Since 13 Nov 2026 every chapter with a quiz also has a lesson: the third one is checked
        # for its « Quiz » pill, after its lessons when it has some.)
        third = CHAPTERS[2]
        n3 = len([l for l in LECONS if l["chapitre"] == third["id"]])
        expected = (f"{n3} leçon{'s' if n3 > 1 else ''} Quiz" if n3 else "Quiz")
        check("a chapter with a quiz: its lessons, then « Quiz », not washed out",
              norm(chaps.nth(2).locator(".chap__acts").inner_text()) == expected and "is-empty" not in chaps.nth(2).get_attribute("class"))
        empties = [i for i, c in enumerate(CHAPTERS) if not c.get("theme") and c["id"] not in with_lessons]
        check("every chapter without lesson or quiz says « Bientôt », and only those",
              [i for i in range(chaps.count()) if "is-empty" in chaps.nth(i).get_attribute("class")] == empties
              and page.locator(f"{VISIBLE} .pill--soon").count() == len(empties))
        check("no « Fiche bientôt », no document pill, no « Tous les documents », no Drive row",
              "Fiche" not in norm(page.locator(f"{VISIBLE} .body").inner_text()) and "document" not in norm(page.locator(f"{VISIBLE} .body").inner_text())
              and page.locator("[data-all-docs], [data-folder]").count() == 0)
        check("a chapter takes the colour of its theme in Réviser (fiche de séance: olivier, anatomie: bougainvillier)",
              "tone-olivier" in chaps.nth(0).get_attribute("class") and "tone-bougainvillier" in chaps.nth(2).get_attribute("class"))
        for bloc in PARCOURS["blocs"]:
            page.locator(".filters__chip", has_text=bloc["short"]).click()
            page.wait_for_timeout(300)
            wanted = [str(i + 1) for i, c in enumerate(CHAPTERS) if c["bloc"] == bloc["id"]]
            check(f"the filter {bloc['short']} keeps its chapters ({len(wanted)}), with the numbers of the full path",
                  [norm(t) for t in page.locator(f"{VISIBLE} .chap__n").all_inner_texts()] == wanted)
            if bloc["id"] == "transversal":
                shot(page, "22-cours-filtre-light")
        page.locator(".filters__chip", has_text="Tout").click()
        page.wait_for_timeout(300)
        page.locator(f"{VISIBLE}").evaluate("e => e.scrollTo(0, 1200)")
        page.wait_for_timeout(300)
        shot(page, "21b-cours-chapitres-light")
        page.locator(f"{VISIBLE}").evaluate("e => e.scrollTo(0, 0)")

        # A chapter with nothing yet: it still opens.
        chaps.nth(1).locator(".chap__card").click()
        page.wait_for_timeout(800)
        text = norm(page.locator(f"{VISIBLE}").inner_text())
        check("an empty chapter opens its page (#cours/seance-et-cycle) with « ‹ Cours »", visible_path(page) == "cours/seance-et-cycle"
              and page.url.endswith("#cours/seance-et-cycle") and norm(page.locator(f"{VISIBLE} .back").inner_text()) == "Cours")
        check("an empty chapter: title, « when · bloc title », résumé, then « Leçons » with one grey row",
              "De la séance au cycle" in text and "Septembre · Séances et cycles pédagogiques" in text
              and "Enchaîner les séances pour faire progresser un groupe." in text
              and page.locator(f"{VISIBLE} .lesson-row.is-soon").count() == 1 and "Les leçons de ce chapitre arrivent." in text)
        check("an empty chapter: no « Réviser ce chapitre »", page.locator(f"{VISIBLE} [data-quiz]").count() == 0)
        locked = page.locator(f"{VISIBLE} .docs-locked")
        check("« Documents »: a disabled grey row with a lock, « Documents du cours » and « Bientôt »", locked.count() == 1
              and norm(locked.inner_text()) == "Documents du cours Bientôt" and locked.locator("use[href='#i-lock']").count() == 1
              and locked.get_attribute("aria-disabled") == "true")
        check("the page of a chapter has no « Fiche bientôt » any more", "Fiche" not in text)
        shot(page, "23-chapitre-vide-light")
        page.locator(f"{VISIBLE} .back").click()
        page.wait_for_timeout(700)

        # A chapter with a lesson.
        chaps.nth(3).locator(".chap__card").click()
        page.wait_for_timeout(800)
        text = norm(page.locator(f"{VISIBLE}").inner_text())
        rows = page.locator(f"{VISIBLE} .lesson-row")
        check("a chapter with a lesson: « Leçons », one row: number, title, « Nouveau » (7 days), « 5 min »",
              visible_path(page) == "cours/filieres-energetiques" and rows.count() == 1
              and norm(rows.first.inner_text()) == "1 Les trois filières en cinq minutes Nouveau 5 min"
              and rows.first.locator(".lesson-row__check").count() == 0)
        order = [norm(t) for t in page.locator(f"{VISIBLE} .section-title").all_inner_texts()]
        quiz_box = page.locator(f"{VISIBLE} [data-quiz]").bounding_box()
        check("the order of the page: Leçons, « Réviser ce chapitre », Documents", order == ["Leçons", "Documents"]
              and rows.first.bounding_box()["y"] < quiz_box["y"] < page.locator(f"{VISIBLE} .docs-locked").bounding_box()["y"])
        check("no « À vérifier » badge outside the Relecture", page.locator(f"{VISIBLE} .lesson-row .tone-citron").count() == 0)
        shot(page, "23-chapitre-light")
        page.locator(f"{VISIBLE} [data-quiz]").click()
        page.wait_for_timeout(1200)
        check("« Réviser ce chapitre » opens its theme in Réviser", visible_path(page) == "reviser/filieres-energetiques")
        page.locator(".tab[data-tab=cours]").click()
        page.wait_for_timeout(600)
        page.locator(".tab[data-tab=cours]").click()
        page.wait_for_timeout(900)
        page.locator(f"{VISIBLE} .chap [data-quiz]").first.click()
        page.wait_for_timeout(1200)
        check("the « Quiz » pill opens the theme in Réviser", visible_path(page) == "reviser/fiche-de-seance")
        page.locator(".tab[data-tab=cours]").click()
        page.wait_for_timeout(600)

        # The glass card opens the lesson over its chapter; × goes back to the chapter.
        page.locator(f"{VISIBLE} .hd .gcard").click()
        page.wait_for_selector(".player--lecon.is-open .lcard__title")
        page.wait_for_timeout(600)
        check("the glass card opens the lesson over the page of its chapter (#cours/fiche-de-seance?lecon=…)",
              page.url.endswith("#cours/fiche-de-seance?lecon=fiche-de-seance-les-bases") and visible_path(page) == "cours/fiche-de-seance"
              and page.locator(".tabbar").evaluate("e => getComputedStyle(e).visibility") == "hidden")
        check("theme-color takes the top of Cours during a lesson", page.locator("meta[name=theme-color]").get_attribute("content").upper() == "#5140CC")
        page.locator(".player__close").click()
        page.wait_for_timeout(900)
        check("× closes the lesson: back on its chapter", page.locator(".player").count() == 0 and visible_path(page) == "cours/fiche-de-seance"
              and page.url.endswith("#cours/fiche-de-seance"))
        ctx.close()

        # Lessons read or started (saved on the phone): the pill, the glass card.
        def lecons_state(**items):
            return {"promo-mapst:lecons": json.dumps(items)}
        ctx, page = phone("cours lus", when="2026-11-16T13:45:00+01:00",
                          storage=lecons_state(**{LECONS[0]["id"]: {"at": 0, "read": "2026-11-15"}, LECONS[1]["id"]: {"at": 3}}))
        open_(page, "#cours")
        pill = page.locator(f"{VISIBLE} .chap").nth(0).locator(".pill").first
        check("all the lessons of a chapter read: the pill is filled, with a check", "pill--done" in pill.get_attribute("class")
              and pill.locator("use[href='#i-check']").count() == 1)
        check("the glass card: the next lesson not read yet, « Continuer » once started",
              norm(page.locator(f"{VISIBLE} .hd .gcard").inner_text()) == f"{LECONS[1]['title']} Continuer · {LECONS[1].get('minutes', 5)} min")
        page.locator(f"{VISIBLE} .chap").nth(0).locator(".chap__card").click()
        page.wait_for_timeout(800)
        check("a lesson read: a check on its row", page.locator(f"{VISIBLE} .lesson-row .lesson-row__check").count() == 1)
        ctx.close()
        ctx, page = phone("cours tout lu", storage=lecons_state(**{l["id"]: {"at": 0, "read": "2026-11-15"} for l in LECONS}))
        open_(page, "#cours")
        check("every lesson read: no glass card", page.locator(f"{VISIBLE} .hd .gcard").count() == 0)
        ctx.close()

        # « Quiz 7/10 »: questions answered right in the theme, over its total.
        QUESTIONS = json.loads((REPO / "content/questions.json").read_text(encoding="utf-8"))
        fiche = [q["id"] for q in QUESTIONS if q["theme"] == "fiche-de-seance"]
        done = {"v": 1, "xp": 70, "days": {}, "done": {i: 2 for i in fiche[:7]}, "cards": {}, "runs": {}, "lastTheme": None}
        ctx, page = phone("cours quiz", storage={"promo-mapst:reviser": json.dumps(done)})
        open_(page, "#cours")
        check("the pill says « Quiz 7/10 » once questions were answered right",
              norm(page.locator(f"{VISIBLE} .chap [data-quiz]").first.inner_text()) == f"Quiz 7/{len(fiche)}")
        ctx.close()

        # With documents (a temporary list of 9, served to this phone only).
        def doc(n, chapitre, kind, title, added="2026-10-01", note=None):
            d = {"id": f"d{n}", "chapitre": chapitre, "title": title, "kind": kind, "url": f"https://drive.google.com/file/d/{n}/view", "added": added}
            if note:
                d["note"] = note
            return d
        DOCS = {"about": "", "folder": "https://drive.google.com/drive/folders/promo", "documents": [
            doc(1, "anatomie-mouvement", "pdf", "Le squelette", note="Le cours du 22 septembre."),
            doc(2, "anatomie-mouvement", "diapo", "Les articulations", added="2026-11-10"),
            doc(3, "anatomie-mouvement", "video", "La contraction musculaire"),
            doc(4, "fiche-de-seance", "doc", "Modèle de fiche de séance"),
            doc(5, "fiche-de-seance", "tableur", "Grille d’évaluation"),
            doc(6, "filieres-energetiques", "pdf", "Les trois filières"),
            doc(7, "general", "lien", "Le site de CAPA Sports"),
            doc(8, "general", "pdf", "Règlement intérieur"),
            doc(9, "chapitre-inconnu", "pdf", "Un document d’un chapitre qui n’existe pas"),
            doc(10, "publics", "pdf", "Les publics", added="2026-11-01"),
            {"id": "d11", "chapitre": "publics", "title": "Un lien qui n’est pas https", "kind": "pdf", "url": "http://exemple.fr/a.pdf", "added": "2026-11-01"},
        ]}
        for scheme in ("light", "dark"):
            ctx, page = phone(f"cours documents {scheme}", when="2026-11-12T13:45:00+01:00", scheme=scheme, content={"documents.json": DOCS})
            open_(page, "#cours")
            if scheme == "dark":
                shot(page, "21-cours-dark")
                ctx.close()
                continue
            check("with documents: no document pill on the path (Phase 5)",
                  "document" not in norm(page.locator(f"{VISIBLE} .path--chap").inner_text()))
            page.locator(f"{VISIBLE}").evaluate("e => e.scrollTo(0, e.scrollHeight)")
            page.wait_for_timeout(300)
            check("at the end of the path: « Tous les documents » (9: the broken ones are skipped) and « Ouvrir le dossier Drive »",
                  "9 documents" in norm(page.locator("[data-all-docs]").inner_text())
                  and page.locator("a[data-folder]").get_attribute("href") == DOCS["folder"] and page.locator("a[data-folder]").get_attribute("target") == "_blank")
            check("the end of the path stays above the tab bar",
                  page.locator("a[data-folder]").bounding_box()["y"] + page.locator("a[data-folder]").bounding_box()["height"] <= page.locator(".tabbar").bounding_box()["y"])
            shot(page, "24-cours-fin-light")
            page.locator(f"{VISIBLE}").evaluate("e => e.scrollTo(0, 0)")
            page.locator(f"{VISIBLE} .chap__card").nth(2).click()
            page.wait_for_timeout(800)
            rows = page.locator(f"{VISIBLE} .doc")
            check("a chapter with documents: the list as in Phase 4, no locked row", page.locator(f"{VISIBLE} .docs-locked").count() == 0)
            check("a chapter with documents: the list, the kind in a small square", rows.count() == 3
                  and [norm(t) for t in page.locator(f"{VISIBLE} .doc-kind").all_inner_texts()] == ["PDF", "DIAPO", "VIDÉO"])
            check("a document: its title, its note, « Nouveau » for 7 days after it was added",
                  norm(rows.nth(0).inner_text()) == "PDF Le squelette Le cours du 22 septembre."
                  and norm(rows.nth(1).inner_text()) == "DIAPO Les articulations Nouveau" and "Nouveau" not in rows.nth(2).inner_text())
            check("a document opens its link in the browser (target=_blank, rel=noopener)",
                  rows.nth(0).get_attribute("href") == "https://drive.google.com/file/d/1/view"
                  and rows.nth(0).get_attribute("target") == "_blank" and rows.nth(0).get_attribute("rel") == "noopener")
            shot(page, "25-chapitre-documents-light")
            page.locator(f"{VISIBLE} .back").click()
            page.wait_for_timeout(700)
            page.locator(f"{VISIBLE}").evaluate("e => e.scrollTo(0, e.scrollHeight)")
            page.locator("[data-all-docs]").click()
            page.wait_for_timeout(800)
            check("« Tous les documents » (#cours/documents): grouped by chapter in the order of the path, then « Général »",
                  visible_path(page) == "cours/documents" and [norm(t) for t in page.locator(f"{VISIBLE} .group-title").all_inner_texts()]
                  == ["La fiche de séance", "Anatomie et mouvement", "Filières énergétiques", "Les publics et leurs caractéristiques", "Général"]
                  and page.locator(f"{VISIBLE} .doc").count() == 9)
            check("a search field from 8 documents", page.locator(f"{VISIBLE} .docs__search input").count() == 1)
            shot(page, "26-tous-les-documents-light")
            page.locator(f"{VISIBLE} .docs__search input").fill("evaluation")
            page.wait_for_timeout(300)
            check("the search: accents and capitals don't count", page.locator(f"{VISIBLE} .doc").count() == 1
                  and "Grille d’évaluation" in page.locator(f"{VISIBLE} .doc").inner_text())
            page.locator(f"{VISIBLE} .docs__search input").fill("zzz")
            page.wait_for_timeout(300)
            check("the search: nothing found says so", "Aucun document ne correspond." in page.locator(f"{VISIBLE}").inner_text())
            ctx.close()
        few = dict(DOCS, documents=DOCS["documents"][:3])
        ctx, page = phone("cours few documents", content={"documents.json": few})
        open_(page, "#cours/documents")
        check("fewer than 8 documents: no search field", page.locator(f"{VISIBLE} .doc").count() == 3 and page.locator(f"{VISIBLE} .docs__search").count() == 0)
        ctx.close()

        # ================================================================ 7. Installing
        IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
        ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"

        def install_sheet(label, user_agent, scheme="light"):
            ctx, page = phone(label, user_agent=user_agent, scheme=scheme, when="2026-11-12T13:45:00+01:00")
            open_(page)
            page.wait_for_selector(".home__sky svg")
            page.wait_for_timeout(2300)
            page.locator(".install").click()
            page.wait_for_selector(".sheet-layer.is-open")
            page.wait_for_timeout(600)
            return ctx, page, norm(page.locator(".sheet").inner_text())

        for scheme in ("light", "dark"):
            ctx, page, text = install_sheet(f"install iphone {scheme}", IPHONE, scheme)
            shot(page, f"27-installer-iphone-{scheme}")
            if scheme == "light":
                steps = [norm(t) for t in page.locator(".sheet .steps li").all_inner_texts()]
                check("iPhone, Safari: the pill opens the sheet (?installer)", "?installer" in page.url and text.startswith("Installer l’appli"))
                check("iPhone, Safari: the sentence and the three steps, word for word",
                      "Sur iPhone, c’est Safari qui installe. Trois gestes :" in text and steps == [
                          "Touche ou en bas de Safari, puis « Partager ».",
                          "Fais défiler et touche « Sur l’écran d’accueil ».",
                          "Touche « Ajouter ». L’appli arrive avec tes autres applis."])
                check("iPhone, Safari: the three small keys (⋯, share, add)", page.locator(".sheet .steps .kbd").count() == 3)
                check("iPhone, Safari: the hint about Instagram and Snapchat, and « J’ai compris »",
                      "Tu ne vois pas ces boutons ? Tu es dans Instagram ou Snapchat : ouvre d’abord le lien dans Safari." in text
                      and norm(page.locator(".sheet [data-understood]").inner_text()) == "J’ai compris")
                page.locator(".sheet [data-understood]").click()
                page.wait_for_timeout(700)
                check("« J’ai compris » closes the sheet", page.locator(".sheet-layer").count() == 0 and "?installer" not in page.url)
            ctx.close()

        ctx, page, text = install_sheet("install ipad", IPHONE.replace("(iPhone; CPU iPhone OS", "(iPad; CPU OS"))
        check("iPad: « en haut » instead of « en bas »", "en haut de Safari" in text and "en bas de Safari" not in text)
        ctx.close()
        ctx, page, text = install_sheet("install chrome ios", IPHONE.replace("Version/18.5", "CriOS/141.0.7390.41"))
        check("iPhone, another browser: step 1 talks about « ton navigateur »",
              norm(page.locator(".sheet .steps li").first.inner_text()) == "Touche le bouton Partager de ton navigateur." and "de Safari" not in text)
        ctx.close()
        ctx, page, text = install_sheet("install instagram", IPHONE.replace("Safari/604.1", "Instagram 350.0.0.30.109"))
        shot(page, "28-installer-instagram-light")
        check("inside another app: first « Ouvre ce lien dans Safari pour installer l’appli. » with « Copier le lien », then the steps",
              text.index("Ouvre ce lien dans Safari pour installer l’appli.") < text.index("Copier le lien") < text.index("en bas de Safari")
              and page.locator(".sheet .steps li").count() == 3)
        ctx.grant_permissions(["clipboard-read", "clipboard-write"])
        page.locator(".sheet [data-copy-link]").click()
        page.wait_for_timeout(400)
        check("« Copier le lien » copies the address of the app", page.evaluate("navigator.clipboard.readText()") == BASE
              and "Lien copié" in page.locator(".toast").inner_text())
        ctx.close()
        ctx, page, text = install_sheet("install android", ANDROID)
        shot(page, "29-installer-android-light")
        check("Android without the browser's window: « Touche ⋮ en haut de Chrome, puis « Installer l’application » »",
              norm(page.locator(".sheet .steps li").inner_text()) == "Touche en haut de Chrome, puis « Installer l’application »."
              and page.locator(".sheet .steps .kbd use").get_attribute("href") == "#i-more" and "Safari" not in text)
        ctx.close()
        # Android when the browser offers its own window: the pill opens it directly.
        ctx, page = phone("install android prompt", user_agent=ANDROID)
        open_(page)
        page.evaluate("""() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.prompted = true; };
            e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); }""")
        page.locator(".install").click()
        page.wait_for_timeout(500)
        check("Android with the browser's own window: the pill opens it directly, no sheet",
              page.evaluate("window.prompted === true") and page.locator(".sheet-layer").count() == 0)
        ctx.close()

        # ================================================================ 8. Dark mode, small phone, laptop
        for hash_, name in (("#reviser", "reviser"), ("#reviser/anatomie-mouvement", "theme"),
                            ("#planning", "planning"), ("#planning/dates-cles", "dates-cles"), ("#accueil/profil", "profil"),
                            ("#planning?seance=2026-11-09-am", "details"), ("#cours/filieres-energetiques", "chapitre"),
                            ("#cours/seance-et-cycle", "chapitre-vide")):
            ctx, page = phone(f"dark {name}", scheme="dark", when="2026-11-09T10:40:00+01:00")
            open_(page, hash_)
            page.wait_for_timeout(300)
            shot(page, f"20-{name}-dark")
            if name == "reviser":
                check("dark mode: the page background is dark", page.evaluate("getComputedStyle(document.body).backgroundColor") == "rgb(11, 26, 40)")
                check("dark mode: theme-color takes the dark top of the tab", page.locator("meta[name=theme-color]").get_attribute("content").upper() == "#00382E")
            if name == "planning":
                page.locator(".gseg__btn[data-view=mois]").click()
                page.wait_for_timeout(500)
                shot(page, "12-planning-mois-dark")
                page.locator(".gseg__btn[data-view=annee]").click()
                page.wait_for_timeout(600)
                shot(page, "13-planning-annee-dark")
                color = page.evaluate("getComputedStyle(document.querySelector('.yday.cat-cours')).color")
                check("dark mode: Année numbers on filled colours are dark (--on-accent)", color == "rgb(11, 26, 40)")
            ctx.close()
        for hash_, name in (("#reviser", "reviser"), ("#reviser/anatomie-mouvement", "theme"), ("#accueil/profil", "profil"), ("#planning/dates-cles", "dates-cles")):
            ctx, page = phone(f"light {name}", when="2026-11-09T10:40:00+01:00")
            open_(page, hash_)
            shot(page, f"18-{name}-light")
            ctx.close()

        # The top of every screen is coloured (the clock of the iPhone is white).
        ctx, page = phone("tops", when="2026-11-09T10:40:00+01:00")
        for hash_, selector in (("#cours", ".hd"), ("#reviser", ".hd"), ("#planning", ".hd"), ("#cours/publics", ".topbar--page"),
                                ("#reviser/publics", ".topbar--page"), ("#planning/dates-cles", ".topbar--page"),
                                ("#accueil/profil", ".topbar--page"), ("#accueil/profil/planning", ".topbar--page"),
                                ("#accueil/profil/donnees", ".topbar--page"), ("#accueil/profil/relecture", ".topbar--page")):
            open_(page, hash_)
            top = page.evaluate(f"""(() => {{ const el = document.elementFromPoint(195, 3).closest('{selector}');
                return el ? getComputedStyle(el).backgroundImage + getComputedStyle(el).color : ''; }})()""")
            check(f"the top of {hash_} is a gradient with white text", "linear-gradient" in top and top.endswith("rgb(255, 255, 255)"))
        open_(page, "#accueil")
        check("the top of #accueil is the sky and its shade", page.evaluate("Boolean(document.elementFromPoint(195, 3).closest('.home'))")
              and page.locator(".home__shade").count() == 1)
        check("nothing in the interface can be selected", page.evaluate("getComputedStyle(document.querySelector('.now__title')).userSelect") == "none")
        check("the page itself never scrolls", page.evaluate("getComputedStyle(document.documentElement).overflow === 'hidden' && getComputedStyle(document.documentElement).overscrollBehaviorY === 'none'"))
        ctx.close()

        # People who asked their phone for less motion: nothing moves, one line stays.
        ctx, page = phone("reduced motion", when="2026-11-09T10:40:00+01:00")
        page.emulate_media(reduced_motion="reduce")
        open_(page)
        page.wait_for_selector(".home__sky svg")
        line = norm(page.locator(".mot").inner_text())
        check("reduced motion: the scene doesn't move, no entrance",
              page.evaluate("getComputedStyle(document.querySelector('.home .b-swell')).animationName") == "none" and page.locator(".is-opening").count() == 0)
        check("reduced motion: the words of « le mot » are simply there", page.evaluate("getComputedStyle(document.querySelector('.mot .w')).opacity") == "1")
        page.locator(".tab[data-tab=cours]").click()
        page.wait_for_timeout(100)
        check("reduced motion: tabs change at once", page.locator(".panel.is-entering, .panel.is-leaving").count() == 0 and visible_path(page) == "cours")
        page.locator(".tab[data-tab=accueil]").click()
        page.wait_for_timeout(9600)
        check("reduced motion: « le mot » doesn't rotate", norm(page.locator(".mot").inner_text()) == line)
        ctx.close()

        ctx, page = phone("small phone", width=320, height=640)
        for hash_ in ("#accueil", "#cours", "#cours/role-educateur", "#cours/filieres-energetiques", "#reviser", "#reviser/role-educateur",
                      "#planning", "#planning/dates-cles", "#accueil/profil"):
            open_(page, hash_)
            check(f"small phone: no sideways scrolling ({hash_})", no_overflow(page))
            if hash_ == "#accueil":
                page.wait_for_timeout(2300)
                top = page.locator(".home__top").bounding_box()
                dock = page.locator(".home__dock").bounding_box()
                check("small phone: the top of Accueil and its dock don't overlap", top["y"] + top["height"] <= dock["y"])
                shot(page, "32-petit-telephone-accueil")
        ctx.close()

        ctx = browser.new_context(viewport={"width": 1280, "height": 800}, color_scheme="light",
                                  service_workers="block", locale="fr-FR", timezone_id="Europe/Paris")
        ctx.add_init_script(CLOCK % "2026-11-09T10:40:00+01:00")
        ctx.add_init_script("localStorage.setItem('promo-mapst:bienvenue', 'true'); localStorage.setItem('promo-mapst:prenom', '\"Sam\"');")
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(f"[laptop] page error: {e}"))
        open_(page)
        page.wait_for_timeout(2300)
        rail = page.locator(".tabbar").bounding_box()
        home = page.locator(".home").bounding_box()
        check("laptop: the tab bar becomes a side rail on the left", rail["x"] == 0 and rail["height"] >= 790 and rail["width"] < 120)
        check("laptop: the sky fills the content column, full height",
              abs((home["x"] + home["width"] / 2) - (96 + (1280 - 96) / 2)) < 2 and home["width"] == 672 and home["height"] == 800)
        page.screenshot(path=SHOTS / "30-laptop-accueil.png")
        open_(page, "#planning")
        column = page.locator(f"{VISIBLE} .slots").bounding_box()
        check("laptop: the content of a tab in a centred column", abs((column["x"] + column["width"] / 2) - (96 + (1280 - 96) / 2)) < 2 and column["width"] <= 640)
        page.screenshot(path=SHOTS / "31-laptop-planning.png")
        open_(page, "#cours")
        page.screenshot(path=SHOTS / "33-laptop-cours.png")
        ctx.close()

        # ================================================================ 9. iPhone and Android details
        html = (REPO / "index.html").read_text(encoding="utf-8")
        check("status bar « black-translucent » (the app draws under the white clock)", 'name="apple-mobile-web-app-status-bar-style" content="black-translucent"' in html)
        check("one theme-color, changed by the app as you move around", html.count('name="theme-color"') == 1)
        launch = re.findall(r'apple-touch-startup-image" href="([^"]+)"', html)
        check("launch images for the iPhone sizes, and every file exists", len(launch) >= 10 and all((REPO / f).is_file() for f in launch))
        manifest = json.loads((REPO / "manifest.webmanifest").read_text(encoding="utf-8"))
        check("manifest: theme_color #0A5489, background_color unchanged", manifest["background_color"] == "#F3F7FA" and manifest["theme_color"] == "#0A5489")
        css = "".join(f.read_text(encoding="utf-8") for f in sorted((REPO / "css").glob("*.css")))
        check("no style depends on :hover outside @media (hover: hover)", ":hover" not in css)
        check("nothing loads from another site", not re.search(r'(src|href)="https?://', html) and "url(http" not in css)
        browser.close()
except Exception:
    # The test stopped in the middle: say what passed so far and what the browser complained about.
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
