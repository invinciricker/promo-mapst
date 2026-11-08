"""
End-to-end test of the Phase 3 screens of Promo MAPST, in a phone-sized Chromium:
the welcome, Accueil (at different moments of the day, and its four skies), getting around
(pages, back button, swipe from the edge, tabs that remember, addresses), the Planning
(Semaine, Mois, Année, details, Dates clés, personal events), Profil and its pages.

    python3 tests/test_app.py [<repo folder>] [<screenshots folder>]

Needs Python Playwright (pip install playwright) and its Chromium. Set CHROME_PATH to use
another Chromium. The clock of the browser is set to a chosen moment (for example Monday
9 November 2026 at 10:40, during a class), so the test gives the same result any day.
Screenshots at 390 × 844, light and dark, are saved to compare with
docs/design/mockups.html (their folder is printed at the end).
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
VISIBLE = ".panel:not([hidden]) .page:not([hidden])"     # the page shown now

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
                  storage=None, width=390, height=844):
            ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=2,
                                      is_mobile=True, has_touch=True, color_scheme=scheme,
                                      service_workers="block", locale="fr-FR", timezone_id="Europe/Paris")
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
            check(f"welcome ({scheme}): install help in a browser, with « Plus tard »",
                  "Installe l’appli" in norm(page.locator(".wl-step:not([hidden])").inner_text())
                  and page.locator("[data-done]").inner_text().strip() == "Plus tard")
            shot(page, f"03-installer-{scheme}")
            page.locator("[data-done]").click()
            page.wait_for_timeout(900)
            check(f"welcome ({scheme}): then Accueil, « Bonjour Sam »", page.locator(".welcome").count() == 0
                  and norm(page.locator(".hero__hello h1").inner_text()) == "Bonjour Sam")
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
        page.locator("[data-done]").click()
        page.wait_for_timeout(800)
        check("Passer: « Bonjour » alone", norm(page.locator(".hero__hello h1").inner_text()) == "Bonjour")
        check("Passer: a person icon instead of the initial", page.locator(".hero__me use").get_attribute("href") == "#i-person")
        ctx.close()

        # Phones that used the app before Phase 3 (progress saved) see the welcome once too.
        ctx, page = phone("old phone", name=None, welcome=False, storage={"promo-mapst:reviser": json.dumps({"v": 1, "xp": 40, "days": {}, "done": {}, "cards": {}})})
        open_(page, "#planning", ".welcome")
        check("a phone of Phase 2 also sees the welcome", page.locator(".welcome").count() == 1)
        ctx.close()

        # ================================================================ 2. Accueil
        ctx, page = phone("accueil saturday", when="2026-11-07T10:30:00+01:00")
        open_(page)
        shot(page, "04-accueil-samedi-light")
        card = norm(page.locator(".today").inner_text())
        check("Accueil, Saturday: « Week-end » and the next half-day with its date",
              "Week-end" in card and "Pas de formation aujourd’hui" in card and "Lundi 9 novembre" in card
              and "Stage APEC · AnimaNice" in card and "9:00" in card)
        check("Accueil: date in the window", norm(page.locator(".hero__hello p").inner_text()) == "Samedi 7 novembre")
        check("Accueil: « Réviser » card with « Commencer » the first time", "Commencer" in page.locator(".revise").inner_text()
              and "0/10" in page.locator(".revise .ring").text_content())
        check("Accueil: nothing else (the window and two cards)", page.locator(f"{VISIBLE} .page__body > *").count() == 3)
        check("Accueil: the tab bar has 3 tabs, Étudier hidden", page.locator(".tab").count() == 3 and "Étudier" not in page.locator(".tabbar").inner_text())
        ctx.close()

        ctx, page = phone("accueil class", when="2026-11-09T10:40:00+01:00")
        open_(page)
        shot(page, "05-accueil-en-cours-light")
        card = norm(page.locator(".today").inner_text())
        check("Accueil, during a class: « En ce moment », progress and « encore 1 h 20 »",
              "En ce moment" in card and "encore 1 h 20" in card and page.locator(".today__progress .bar i").count() == 1)
        check("Accueil, during a class: « Ensuite » 13:00", "Ensuite" in card and "13:00" in card)
        check("Accueil, morning: the sky of the day (jour)", "baie-jour.svg" in page.locator(".hero__img").get_attribute("src"))
        page.locator(f"{VISIBLE} .today [data-open-slot]").first.click()
        page.wait_for_selector(".sheet-layer.is-open")
        page.wait_for_timeout(500)
        check("Accueil: a half-day opens its details, with its address", "?seance=2026-11-09-am" in page.url
              and "Stage APEC · AnimaNice" in page.locator(".sheet").inner_text())
        page.locator("[data-theme-id]").click()
        page.wait_for_timeout(1200)
        check("details: « Réviser ce thème » opens the theme in Réviser", visible_path(page) == "reviser/entretien-corporel"
              and page.locator(".tab[data-tab=reviser]").get_attribute("aria-selected") == "true")
        ctx.close()

        ctx, page = phone("accueil lunch", when="2026-11-09T12:20:00+01:00")
        open_(page)
        card = norm(page.locator(".today").inner_text())
        check("Accueil, lunch break: the next half-day (« Dans 40 min »)", "Dans 40 min" in card and "13:00" in card)
        ctx.close()

        progress = {"v": 1, "xp": 120, "days": {"2026-11-21": {"xp": 40, "done": 1}, "2026-11-22": {"xp": 40, "done": 1}, "2026-11-23": {"xp": 40, "done": 1}},
                    "done": {}, "cards": {}, "runs": {}, "lastTheme": None}
        ctx, page = phone("accueil evening dark", when="2026-11-24T21:30:00+01:00", scheme="dark",
                          storage={"promo-mapst:reviser": json.dumps(progress)})
        open_(page)
        shot(page, "06-accueil-soir-dark")
        card = norm(page.locator(".today").inner_text())
        check("Accueil, evening: « Fini pour aujourd’hui », then « Demain »",
              "Fini pour aujourd’hui" in card and "Bonne soirée" in card and "Demain" in card and "Mercredi au centre de loisirs" in card)
        check("Accueil, evening: « Bonsoir Sam » on the night sky, in white",
              norm(page.locator(".hero__hello h1").inner_text()) == "Bonsoir Sam" and "baie-nuit.svg" in page.locator(".hero__img").get_attribute("src")
              and page.evaluate("getComputedStyle(document.querySelector('.hero__hello h1')).color") == "rgb(255, 255, 255)")
        check("Accueil, evening: « Une leçon ce soir pour garder ta série. »",
              "Une leçon ce soir pour garder ta série." in norm(page.locator(".revise").inner_text()) and "3 jours" in page.locator(".revise").inner_text())
        ctx.close()

        ctx, page = phone("accueil holiday", when="2026-11-11T10:00:00+01:00")
        open_(page)
        card = norm(page.locator(".today").inner_text())
        check("Accueil, 11 November: the holiday", "Armistice" in card and "Jour férié" in card and "Demain" in card)
        ctx.close()

        ctx, page = phone("accueil christmas", when="2026-12-23T10:00:00+01:00")
        open_(page)
        card = norm(page.locator(".today").inner_text())
        check("Accueil, Christmas holidays: « Vacances de Noël » and the next class in January",
              "Vacances de Noël" in card and "Lundi 4 janvier" in card)
        ctx.close()

        events = [{"id": "e1", "title": "Footing", "date": "2027-03-05", "allDay": False, "start": "18:00", "end": "19:00", "repeat": "none", "place": "", "note": ""}]
        ctx, page = phone("accueil deadline", when="2027-03-05T08:00:00+01:00", storage={"promo-mapst:events": json.dumps(events)})
        open_(page)
        shot(page, "07-accueil-dossier-light")
        card = norm(page.locator(".today").inner_text())
        check("Accueil: a dossier due within 14 days, with its J-x", "Dossier BC3 à rendre" in card and "J‑10" in card)
        check("Accueil: today's personal event", "Footing" in card and "18:00" in card)
        page.locator(f"{VISIBLE} [data-edit-event='e1']").click()
        page.wait_for_selector(".sheet-layer.is-open")
        check("Accueil: a personal event opens its form", "?evenement=e1" in page.url and "Modifier l’événement" in page.locator(".sheet").inner_text())
        ctx.close()

        # The four skies, forced in the address; and the real sky at four moments.
        for sky in ("aube", "jour", "couchant", "nuit"):
            ctx, page = phone(f"sky {sky}", when="2026-11-09T12:00:00+01:00")
            open_(page, f"#accueil?ciel={sky}")
            check(f"#accueil?ciel={sky} shows that sky", f"baie-{sky}.svg" in page.locator(".hero__img").get_attribute("src"))
            page.locator(".hero").screenshot(path=SHOTS / f"08-ciel-{sky}.png")
            ctx.close()
        skies = {}
        for moment in ("07:30", "12:00", "16:30", "20:00"):
            ctx, page = phone(f"real sky {moment}", when=f"2026-11-09T{moment}:00+01:00")
            open_(page)
            skies[moment] = page.locator(".hero").get_attribute("data-sky")
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
        page.locator(".hero__me").click()
        page.wait_for_timeout(700)
        check("the round initial opens Profil (#accueil/profil)", visible_path(page) == "accueil/profil" and page.url.endswith("#accueil/profil"))
        check("a page opened from another has « ‹ Accueil »", norm(page.locator(f"{VISIBLE} .back").inner_text()) == "Accueil")
        page.locator(f"{VISIBLE} .back").click()
        page.wait_for_timeout(700)
        check("« ‹ » goes back", visible_path(page) == "accueil" and page.url.endswith("#accueil"))
        page.locator(".hero__me").click()
        page.wait_for_timeout(700)
        swipe(page, 6, 330, 500)
        page.wait_for_timeout(900)
        check("a swipe from the left edge goes back", visible_path(page) == "accueil")
        page.locator(".tab[data-tab=reviser]").click()
        page.wait_for_timeout(400)
        page.locator(f"{VISIBLE} [data-theme=publics]").click()
        page.wait_for_timeout(700)
        page.locator(".tab[data-tab=planning]").click()
        page.wait_for_timeout(400)
        page.locator(f"{VISIBLE} [data-dates-cles]").click()
        page.wait_for_timeout(700)
        page.locator(".tab[data-tab=reviser]").click()
        page.wait_for_timeout(500)
        check("each tab remembers where you were (Réviser: the theme)", visible_path(page) == "reviser/publics")
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
        # Old addresses, and addresses opened directly.
        page.goto(BASE + "#infos")
        page.wait_for_timeout(700)
        check("old #infos opens Profil", visible_path(page) == "accueil/profil" and page.url.endswith("#accueil/profil"))
        for address, expect in (("#planning/dates-cles", "planning/dates-cles"), ("#reviser/fiche-de-seance", "reviser/fiche-de-seance"),
                                ("#accueil/profil/donnees", "accueil/profil/donnees")):
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
              page.locator(".seg__btn[aria-checked=true]").inner_text().strip() == "Semaine"
              and page.locator(".wk-day.is-on b").inner_text() == "7" and "2 – 8 novembre" in norm(page.locator(".weekhead").inner_text()))
        check("a day without class says so, with a link to the next class day",
              "Week-end, pas de formation." in norm(page.locator(".pl-empty").inner_text()) and "lundi 9 novembre" in norm(page.locator(".pl-empty__link").inner_text()))
        check("the week strip: a dot per half-day", page.locator(".wk-day").nth(0).locator(".dots i").count() == 2)
        check("the correction of 2–20 November shows as a citron banner", "Du 2 au 20 novembre" in norm(page.locator(".pl-banner").first.inner_text()))
        page.locator(".pl-empty__link").click()
        page.wait_for_timeout(500)
        check("the link opens the next class day (week of 9–15 November)", "9 – 15 novembre" in norm(page.locator(".weekhead").inner_text())
              and norm(page.locator(".dayhead").inner_text()).startswith("Lundi 9 novembre"))
        rows = norm(page.locator(".pl-day").inner_text())
        check("a day: hours, title, place and who", "9:00" in rows and "12:00" in rows and "Stage APEC · AnimaNice" in rows and "Structures AnimaNice, Ville de Nice" in rows)
        banners = norm(" ".join(page.locator(".pl-banner").all_inner_texts()))
        check("the note of 11 November shows in its week", "Mercredi 11 novembre" in banners and "Du 2 au 20 novembre" in banners)
        shot(page, "10-planning-semaine-9-light")
        page.locator(".wk-day").nth(2).click()
        page.wait_for_timeout(400)
        check("Wednesday 11: the holiday", "Armistice, férié" in norm(page.locator(".pl-day").inner_text()))
        page.locator(".arrow[data-step='1']").click()
        page.wait_for_timeout(400)
        check("the arrow: next week, same day", "16 – 22 novembre" in norm(page.locator(".weekhead").inner_text()) and page.locator(".wk-day.is-on b").inner_text() == "18")
        strip = page.locator(".wk-strip").bounding_box()
        swipe(page, strip["x"] + 300, strip["x"] + 80, strip["y"] + 40)
        page.wait_for_timeout(500)
        check("a swipe on the strip: the next week", "23 – 29 novembre" in norm(page.locator(".weekhead").inner_text()))
        check("no APEC banner after 20 November", "Du 2 au 20 novembre" not in norm(page.locator(".pl-view").inner_text()))
        day_list = page.locator(".pl-daylist").bounding_box()
        swipe(page, day_list["x"] + 80, day_list["x"] + 300, day_list["y"] + 30)
        page.wait_for_timeout(500)
        check("a swipe on the list: the day before", norm(page.locator(".dayhead").inner_text()).startswith("Mardi 24 novembre"))
        # « À vérifier » on a half-day with a note (place not given in the official planning).
        checked = next(k for k, d in sorted(PLANNING["days"].items()) if k >= "2026-11-07" and any(s.get("check") for s in d.get("slots", [])))
        page.goto(BASE + f"#planning?seance={checked}-{next(s['half'] for s in PLANNING['days'][checked]['slots'] if s.get('check'))}")
        page.reload()
        page.wait_for_selector(".sheet-layer.is-open")
        check(f"details of a half-day to check: its « À vérifier » note ({checked})", "À vérifier." in page.locator(".sheet").inner_text())
        shot(page, "11-details-a-verifier-light")
        page.go_back()
        page.wait_for_timeout(600)
        check("… and a small « À vérifier » tag in its day", page.locator(".pl-day .tag.tone-citron").count() >= 1)
        # Mois and Année
        page.locator(".seg__btn[data-view=mois]").click()
        page.wait_for_timeout(500)
        shot(page, "12-planning-mois-light")
        check("Mois: a calendar of the month", page.locator(".mday:not(.mday--blank)").count() == 30 and "Novembre 2026" in page.locator(".weekhead").inner_text())
        page.locator(".mday", has_text="10").first.click()
        page.wait_for_timeout(400)
        check("Mois: a tapped day shows its half-days", norm(page.locator(".dayhead").inner_text()).startswith("Mardi 10 novembre")
              and "Stage APEC" in page.locator(".pl-daylist").inner_text())
        page.locator(".arrow[data-step='1']").click()
        page.wait_for_timeout(400)
        check("Mois: the arrow, next month", "Décembre 2026" in page.locator(".weekhead").inner_text())
        page.locator(".seg__btn[data-view=annee]").click()
        page.wait_for_timeout(600)
        shot(page, "13-planning-annee-light")
        check("Année: September to June", page.locator(".ymonth").count() == 10)
        check("Année: the stages of the year", page.locator(".stage").count() == len(PLANNING["stages"]))
        page.locator(".ymonth").nth(4).locator(".ymonth__head").click()      # January
        page.wait_for_timeout(500)
        check("Année: a month opens Mois", page.locator(".seg__btn[aria-checked=true]").inner_text().strip() == "Mois" and "Janvier 2027" in page.locator(".weekhead").inner_text())
        page.locator(".seg__btn[data-view=annee]").click()
        page.wait_for_timeout(500)
        page.locator(".yday[data-goto-week='2027-02-03']").click()
        page.wait_for_timeout(500)
        check("Année: a day opens its week", page.locator(".seg__btn[aria-checked=true]").inner_text().strip() == "Semaine"
              and norm(page.locator(".dayhead").inner_text()).startswith("Mercredi 3 février"))
        page.locator("[data-today]").click()
        page.wait_for_timeout(500)
        check("« Aujourd’hui » comes back to today", page.locator(".wk-day.is-on b").inner_text() == "7")
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
              and page.locator(".pl-row.cat-perso").count() == 1)
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
        check("Profil: the footer text", "Application non officielle créée par un stagiaire. En cas de doute, vérifie dans tes cours." in text)
        page.locator("[data-name]").click()
        page.wait_for_selector(".sheet-layer.is-open input")
        page.locator(".sheet input").fill("Alex")
        page.locator(".sheet [type=submit]").click()
        page.wait_for_timeout(700)
        check("Changer mon prénom: Profil follows", norm(page.locator(f"{VISIBLE} .me-big h1").inner_text()) == "Alex")
        page.locator(f"{VISIBLE} .back").click()
        page.wait_for_timeout(700)
        check("… and Accueil too", norm(page.locator(".hero__hello h1").inner_text()) == "Bonjour Alex" and page.locator(".hero__me").inner_text().strip() == "A")
        page.locator(".hero__me").click()
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
        check("Ce que l’appli garde: the list, and nothing sent elsewhere", "Ton prénom" in text and "« Alex »" in text and "Rien n’est envoyé ailleurs" in text)
        reset = page.locator("[data-reset]")
        reset.click()
        armed = "Touche encore" in reset.inner_text()
        reset.click()
        page.wait_for_timeout(400)
        check("« Effacer ma progression »: two taps", armed and page.evaluate("localStorage.getItem('promo-mapst:reviser')") is None)
        page.go_back()
        page.wait_for_timeout(600)
        page.locator("[data-install]").click()
        page.wait_for_selector(".sheet-layer.is-open")
        check("Installer l’appli: the steps in a sheet", "?installer" in page.url and "Installer l’appli" in page.locator(".sheet").inner_text())
        ctx.close()

        # ================================================================ 6. Dark mode, small phone, laptop
        for hash_, name in (("#accueil", "accueil"), ("#reviser", "reviser"), ("#reviser/anatomie-mouvement", "theme"),
                            ("#planning", "planning"), ("#planning/dates-cles", "dates-cles"), ("#accueil/profil", "profil"),
                            ("#planning?seance=2026-11-09-am", "details")):
            ctx, page = phone(f"dark {name}", scheme="dark", when="2026-11-09T10:40:00+01:00")
            open_(page, hash_)
            page.wait_for_timeout(300)
            shot(page, f"20-{name}-dark")
            if name == "accueil":
                check("dark mode: the page background is dark", page.evaluate("getComputedStyle(document.body).backgroundColor") == "rgb(11, 26, 40)")
            ctx.close()
        for hash_, name in (("#reviser", "reviser"), ("#reviser/anatomie-mouvement", "theme"), ("#accueil/profil", "profil"), ("#planning/dates-cles", "dates-cles")):
            ctx, page = phone(f"light {name}", when="2026-11-09T10:40:00+01:00")
            open_(page, hash_)
            shot(page, f"18-{name}-light")
            ctx.close()

        ctx, page = phone("small phone", width=320, height=640)
        for hash_ in ("#accueil", "#reviser", "#reviser/role-educateur", "#planning", "#planning/dates-cles", "#accueil/profil"):
            open_(page, hash_)
            check(f"small phone: no sideways scrolling ({hash_})", no_overflow(page))
        ctx.close()

        ctx = browser.new_context(viewport={"width": 1280, "height": 800}, color_scheme="light",
                                  service_workers="block", locale="fr-FR", timezone_id="Europe/Paris")
        ctx.add_init_script(CLOCK % "2026-11-09T10:40:00+01:00")
        ctx.add_init_script("localStorage.setItem('promo-mapst:bienvenue', 'true'); localStorage.setItem('promo-mapst:prenom', '\"Sam\"');")
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(f"[laptop] page error: {e}"))
        open_(page)
        rail = page.locator(".tabbar").bounding_box()
        column = page.locator(f"{VISIBLE} .page__body").bounding_box()
        hero = page.locator(".hero").bounding_box()
        check("laptop: the tab bar becomes a side rail on the left", rail["x"] == 0 and rail["height"] >= 790 and rail["width"] < 120)
        check("laptop: the content in a centred column, the window grows with it",
              abs((column["x"] + column["width"] / 2) - (96 + (1280 - 96) / 2)) < 2 and hero["width"] > 600)
        page.screenshot(path=SHOTS / "30-laptop-accueil.png")
        open_(page, "#planning")
        page.screenshot(path=SHOTS / "31-laptop-planning.png")
        ctx.close()

        # ================================================================ 7. iPhone details
        html = (REPO / "index.html").read_text(encoding="utf-8")
        check("status bar « default » (a dark clock on the light app)", 'name="apple-mobile-web-app-status-bar-style" content="default"' in html)
        check("theme-color follows the page background, light and dark", 'content="#F3F7FA" media="(prefers-color-scheme: light)"' in html
              and 'content="#0B1A28" media="(prefers-color-scheme: dark)"' in html)
        launch = re.findall(r'apple-touch-startup-image" href="([^"]+)"', html)
        check("launch images for the iPhone sizes, and every file exists", len(launch) >= 10 and all((REPO / f).is_file() for f in launch))
        manifest = json.loads((REPO / "manifest.webmanifest").read_text(encoding="utf-8"))
        check("manifest colours follow the page", manifest["background_color"] == "#F3F7FA" and manifest["theme_color"] == "#F3F7FA")
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
