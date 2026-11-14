"""
Test of the accounts, the classement and « Questions de la promo » (Phase 6), in a
phone-sized Chromium, on the pretend backend (js/compte/backend-faux.js, ?backend=faux):
nothing is sent to Firebase.

  - accounts switched off (js/compte/config.js empty): every account feature is hidden;
  - accounts on but no account: the app is as before, and Firebase is not even loaded;
  - the welcome step « Garde ta progression », and the account sheet over the welcome;
  - creating an account (each error: pseudo, 6 digits, obvious codes, two codes
    different, wrong class code, pseudo taken, offline), signing in (wrong code, too many
    tries, an account without the class code), signing out, changing the code, deleting;
  - the sync of the progress (a new phone gets it; a lesson read is saved online);
  - the classement (order, own row, top three, the week only, hidden banner, caps on what
    is sent: 3 000 on the first line, then +400);
  - the questions (the ways in, the list and its filters, « Moi aussi », asking from a
    chapter, deleting one's own, the admin answering and deleting), offline.

    python3 tests/test_compte.py [<repo folder>] [<screenshots folder>]

Needs Python Playwright (pip install playwright) and its Chromium (or CHROME_PATH).
Screenshots at 390 × 844, light and dark: the create sheet, Profil signed in, the
classement, the list of questions, a question with its answer. It takes about a minute
(the classement caps wait for the next sync, 15 s later).
"""
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(tempfile.mkdtemp(prefix="promo-mapst-compte-"))
SHOTS.mkdir(parents=True, exist_ok=True)
NBSP = " "
VISIBLE = ".panel.is-on .page:not([hidden])"
SHEET = ".sheet-layer.is-open .sheet"

NOW = "2026-11-13T18:02:00+01:00"            # a Friday, ISO week 2026-W46
T = int(datetime(2026, 11, 13, 17, 2, tzinfo=timezone.utc).timestamp() * 1000)
DAY = 86400000
WEEK = "2026-W46"

results = []
errors = []


def check(name, ok):
    results.append((name, bool(ok)))
    if not ok:
        print(f"FAIL  {name}", flush=True)


def norm(text):
    return re.sub(r"\s+", " ", (text or "").replace(NBSP, " ").replace("’", "'")).strip()


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

EMPTY_CONFIG = """export const firebaseConfig = { apiKey: "", authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: "" };
export const DOMAINE = "promo-mapst.example.com";"""


def progress(xp, days, lecons=None, done=None):
    return {"v": 1, "xp": xp, "days": days, "done": done or {}, "cards": {}, "runs": {}, "lastTheme": None}, (lecons or {})


SAM_REVISER, _ = progress(260, {"2026-11-13": {"xp": 120, "done": 2}, "2026-11-10": {"xp": 40, "done": 1},
                               "2026-11-05": {"xp": 100, "done": 1}})            # 160 XP this week
LEA_REVISER, LEA_LECONS = progress(500, {"2026-11-12": {"xp": 80, "done": 2}}, {"fiche-de-seance-les-bases": {"at": 0, "read": "2026-11-12"}},
                                   {"fds-1-01": 2})


def membre(pseudo, reviser=None, lecons=None):
    return {"pseudo": pseudo, "code": "mapst-test", "creeLe": T - 5 * DAY,
            "progres": json.dumps({"v": 1, "reviser": reviser, "lecons": lecons or {}}), "majLe": T - 3600000}


def server_seed():
    return {
        "codes": ["mapst-test"],
        "admins": ["prof"],
        "users": {"prof": {"code": "270514", "tries": 0}, "lea": {"code": "839201", "tries": 0},
                  "sansprofil": {"code": "556677", "tries": 0}, "bloque": {"code": "102938", "tries": 5}},
        "membres": {"prof": membre("Prof"), "lea": membre("Lea", LEA_REVISER, LEA_LECONS)},
        "classement": {
            "lea": {"pseudo": "Lea", "xp": 300, "semaine": WEEK, "majLe": T - 3600000},
            "tom": {"pseudo": "Tom", "xp": 150, "semaine": WEEK, "majLe": T - 3600000},
            "zoe": {"pseudo": "Zoe", "xp": 150, "semaine": WEEK, "majLe": T - 3600000},
            "carl": {"pseudo": "Carl", "xp": 999, "semaine": "2026-W45", "majLe": T - 7 * DAY},
        },
        "questions": {
            "q1": {"texte": "Quelle est la différence entre un objectif général et un objectif opérationnel ? On l'a vu lundi mais je mélange encore les deux quand j'écris ma fiche de séance.",
                   "auteur": "lea", "pseudo": "Lea", "chapitre": "fiche-de-seance", "creeLe": T - 2 * DAY, "reponse": "", "aussi": ["tom"]},
            "q2": {"texte": "On a combien de temps pour rendre le dossier du stage ?", "auteur": "tom", "pseudo": "Tom", "chapitre": "",
                   "creeLe": T - 5 * DAY, "reponse": "Trois semaines après la fin du stage.\nLa date exacte est dans Planning, Dates clés.",
                   "reponduLe": T - 4 * DAY, "aussi": []},
        },
    }


PORT = free_port()
BASE = f"http://127.0.0.1:{PORT}/"
server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=REPO,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None)

        def phone(label, scheme="light", storage=None, seed=True, welcome=True, name="Sam", config_empty=False, signed_in=None):
            """A phone. seed: the pretend server (server_seed()). signed_in: (pseudo, classement)
            to start signed in without going through the sheet."""
            ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                      is_mobile=True, has_touch=True, color_scheme=scheme,
                                      service_workers="block", locale="fr-FR", timezone_id="Europe/Paris")
            if config_empty:
                ctx.route("**/js/compte/config.js", lambda route: route.fulfill(
                    status=200, content_type="text/javascript; charset=utf-8", body=EMPTY_CONFIG))
            ctx.add_init_script(CLOCK % NOW)
            setup = {}
            if welcome:
                setup["promo-mapst:bienvenue"] = "true"
            if name:
                setup["promo-mapst:prenom"] = json.dumps(name)
            if seed:
                setup["faux-backend"] = json.dumps(server_seed())
            if signed_in:
                pseudo, classement = signed_in
                setup["faux-backend:session"] = pseudo.lower()
                setup["promo-mapst:compte"] = json.dumps({"pseudo": pseudo, "cle": pseudo.lower(), "classement": classement, "sync": T - 120000})
            setup.update(storage or {})
            ctx.add_init_script("if (!localStorage.getItem('test-seeded')) {" + "".join(
                f"localStorage.setItem({json.dumps(k)}, {json.dumps(v)});" for k, v in setup.items())
                + "localStorage.setItem('test-seeded', '1'); }")
            page = ctx.new_page()
            watch(page, label)
            return ctx, page

        def watch(page, label):
            def on_console(m):
                if m.type in ("error", "warning") and "Service Worker registration blocked" not in m.text:
                    errors.append(f"[{label}] console {m.type}: {m.text}")
            page.on("console", on_console)
            page.on("pageerror", lambda e: errors.append(f"[{label}] page error: {e}"))

        loads = [0]

        def go(page, hash_="#accueil", backend="faux", wait=VISIBLE):
            """Opens the app on an address (a real load each time, like opening the app)."""
            loads[0] += 1
            page.goto(BASE + f"?n={loads[0]}" + (f"&backend={backend}" if backend else "") + hash_)
            page.wait_for_selector(wait)
            page.wait_for_timeout(600)

        def visible_path(page):
            return page.evaluate(f"document.querySelector('{VISIBLE}').dataset.path")

        def shot(page, name):
            page.screenshot(path=SHOTS / f"{name}.png")

        def srv(page):
            return page.evaluate("window.fauxBackend ? window.fauxBackend.serveur() : JSON.parse(localStorage.getItem('faux-backend'))")

        def local(page, key):
            return page.evaluate(f"JSON.parse(localStorage.getItem('promo-mapst:{key}'))")

        def sheet_text(page):
            return norm(page.locator(SHEET).inner_text())

        def err(page, name):
            box = page.locator(f"{SHEET} [data-err='{name}']")
            return norm(box.inner_text()) if box.count() else ""

        def toast(page):
            """The text of the next new toast (one already read is skipped)."""
            last = "[...document.querySelectorAll('.toast.is-visible')].pop()"
            page.wait_for_function(f"() => {{ const t = {last}; return Boolean(t && !t.dataset.seen); }}", timeout=5000)
            return norm(page.evaluate(f"() => {{ const t = {last}; t.dataset.seen = '1'; return t.innerText; }}"))

        def fill(page, **fields):
            for name, value in fields.items():
                page.locator(f"{SHEET} [name='{name}']").fill(value)

        def submit(page, wait=700):
            page.locator(f"{SHEET} [type=submit]").click()
            page.wait_for_timeout(wait)

        def open_profil_sheet(page, mode):
            page.locator(f"{VISIBLE} [data-compte='{mode}']").first.click()
            page.wait_for_selector(SHEET)
            page.wait_for_timeout(500)

        # ================================================================ 1. Accounts switched off
        ctx, page = phone("sans config", config_empty=True)
        requested = []
        page.on("request", lambda r: requested.append(r.url))
        go(page, "#accueil/profil", backend=None)
        check("config empty: no « Mon compte » in Profil", page.locator(f"{VISIBLE} .compte-card, {VISIBLE} .compte-list").count() == 0
              and "Mon compte" not in norm(page.locator(VISIBLE).inner_text()))
        page.locator(".tab[data-tab='cours']").click()
        page.wait_for_timeout(900)
        check("config empty: no « Poser une question », no « Questions de la promo » in Cours",
              page.locator(f"{VISIBLE} [data-poser], {VISIBLE} [data-questions]").count() == 0)
        page.locator(f"{VISIBLE} [data-chapter='fiche-de-seance']").click()
        page.wait_for_timeout(800)
        check("config empty: no « Une question sur ce chapitre ? »", page.locator(f"{VISIBLE} [data-poser]").count() == 0)
        page.locator(".tab[data-tab='reviser']").click()
        page.wait_for_timeout(900)
        check("config empty: the XP chip of Réviser is not a button", page.locator(f"{VISIBLE} .hd [data-classement]").count() == 0
              and "XP" in norm(page.locator(f"{VISIBLE} .hd__end").inner_text()))
        page.locator(f"{VISIBLE} .hd__end").scroll_into_view_if_needed()
        go(page, "#reviser/classement", backend=None)
        check("config empty: #reviser/classement does not exist", visible_path(page) != "reviser/classement")
        go(page, "#cours/questions", backend=None)
        check("config empty: #cours/questions does not exist", visible_path(page) != "cours/questions")
        page.evaluate("localStorage.removeItem('promo-mapst:bienvenue')")
        go(page, "#accueil", backend=None, wait=".welcome")
        page.locator("[data-next]").click()
        page.wait_for_timeout(400)
        page.locator("[data-skip]").click()
        page.wait_for_timeout(500)
        check("config empty: the welcome has no account step", "Installe" in norm(page.locator(".wl-step:not([hidden])").inner_text())
              and page.locator("[data-account]").count() == 0)
        check("config empty: neither Firebase nor the backend is ever loaded",
              not [u for u in requested if "vendor/firebase" in u or "js/compte/backend" in u])
        ctx.close()

        # ================================================================ 2. Accounts on, no account: as before
        ctx, page = phone("sans compte", seed=False)
        requested = []
        page.on("request", lambda r: requested.append(r.url))
        go(page, "#accueil", backend=None)
        for tab in ("cours", "reviser", "planning", "accueil"):
            page.locator(f".tab[data-tab='{tab}']").click()
            page.wait_for_timeout(700)
        go(page, "#accueil/profil", backend=None)
        page.wait_for_timeout(1800)
        check("no account: Firebase is not loaded at launch (nor the backend)",
              not [u for u in requested if "vendor/firebase" in u or "js/compte/backend" in u])
        check("no account: nothing is asked from another website", not [u for u in requested if not u.startswith(BASE)])
        check("no account: Profil shows « Mon compte » with its two buttons",
              "Sauvegarde ta progression et rejoins le classement." in norm(page.locator(f"{VISIBLE} .compte-card").inner_text())
              and page.locator(f"{VISIBLE} [data-compte='creer']").inner_text().strip() == "Créer mon compte"
              and norm(page.locator(f"{VISIBLE} [data-compte='connecter']").inner_text()) == "J'ai déjà un compte")
        page.locator(f"{VISIBLE} [data-how]").click()
        page.wait_for_selector(SHEET)
        page.wait_for_timeout(400)
        how = sheet_text(page)
        check("Profil › « Comment ça marche »: the account, the classement and the questions",
              "Ton compte" in how and "Le classement" in how and "Questions de la promo" in how)
        page.go_back()
        page.wait_for_timeout(500)
        ctx.close()

        # ================================================================ 3. The welcome, and an account made from it
        ctx, page = phone("bienvenue", welcome=False, name=None)
        go(page, "#accueil", wait=".welcome")
        page.locator("[data-next]").click()
        page.wait_for_timeout(400)
        page.locator(".wl-name").fill("Noa")
        page.locator(".wl-form [type=submit]").click()
        page.wait_for_timeout(500)
        step = norm(page.locator(".wl-step:not([hidden])").inner_text())
        check("welcome: « Garde ta progression » after « Ton prénom »", "Garde ta progression" in step
              and "Avec un compte, tu retrouves tes XP sur un nouveau téléphone et tu peux poser tes questions à la promo." in step)
        check("welcome: three steps after Bienvenue (name, account, install)", page.locator(".wl-step:not([hidden]) .wl-steps i").count() == 3)
        page.locator("[data-account='creer']").click()
        page.wait_for_selector(SHEET)
        page.wait_for_timeout(600)
        box = page.locator(SHEET).bounding_box()
        on_top = page.evaluate(f"(() => {{ const e = document.elementFromPoint({box['x'] + box['width'] / 2}, {box['y'] + 60}); return Boolean(e && e.closest('.sheet')); }})()")
        check("welcome: the account sheet opens over the welcome", on_top)
        page.go_back()                                  # Android's back: closes the sheet only
        page.wait_for_timeout(700)
        check("welcome: « back » closes the sheet and stays on the step", page.locator(SHEET).count() == 0
              and "Garde ta progression" in norm(page.locator(".wl-step:not([hidden])").inner_text()))
        page.locator("[data-account='creer']").click()
        page.wait_for_selector(SHEET)
        page.wait_for_timeout(500)
        fill(page, pseudo="Noa", code="839104", code2="839104", promo="mapst-test")
        submit(page, wait=200)
        check("welcome: « Compte créé. Ta progression est sauvegardée. »", toast(page) == "Compte créé. Ta progression est sauvegardée.")
        page.wait_for_timeout(600)
        check("welcome: then the install step", "Installe" in norm(page.locator(".wl-step:not([hidden])").inner_text()))
        page.locator("[data-done]").click()
        page.wait_for_timeout(900)
        check("welcome: the account is saved on the phone", (local(page, "compte") or {}).get("pseudo") == "Noa")
        check("welcome: the first name stays on the phone only, the profile has the pseudo",
              srv(page)["membres"]["noa"]["pseudo"] == "Noa" and "Noa" not in srv(page)["membres"]["noa"]["progres"])
        ctx.close()

        # ================================================================ 4. Creating an account from Profil
        ctx, page = phone("créer", storage={"promo-mapst:reviser": json.dumps(SAM_REVISER)})
        go(page, "#accueil/profil")
        open_profil_sheet(page, "creer")
        text = sheet_text(page)
        check("create: the fields, the hints and the warning", all(t in text for t in [
            "Créer mon compte", "Pseudo", "Pas ton nom complet. 3 à 15 lettres ou chiffres.", "Code à 6 chiffres", "Encore une fois",
            "N'utilise pas le code de ta carte bancaire ni celui de ton téléphone.", "Code de la promo",
            "Celui donné dans le groupe de la promo.", "Apparaître dans le classement",
            "Les autres voient ton pseudo et tes XP de la semaine.", "Ce qui est enregistré", "J'ai déjà un compte"]))
        code = page.locator(f"{SHEET} [name='code']")
        check("create: the code is hidden, with a number keypad", code.get_attribute("type") == "password"
              and code.get_attribute("inputmode") == "numeric")
        check("create: « Apparaître dans le classement » is off at first", not page.locator(f"{SHEET} [name='classement']").is_checked())
        page.locator(f"{SHEET} .compte-form__more summary").click()
        page.wait_for_timeout(200)
        check("create: « Ce qui est enregistré » opens", "Pas d'e-mail, pas de nom. C'est stocké en Europe, chez Google Firebase." in sheet_text(page))
        page.locator(f"{SHEET} .compte-form__more summary").click()
        shot(page, "01-creer-light")
        submit(page)
        check("create: empty → an error under each field", err(page, "pseudo") == "3 à 15 lettres, chiffres, - ou _"
              and err(page, "code") == "Il faut 6 chiffres."
              and err(page, "promo") == "Ce code de la promo n'est pas bon. Demande-le à ton groupe.")
        fill(page, pseudo="Sam 42", code="12345a")
        check("create: only digits can be typed in a code", page.locator(f"{SHEET} [name='code']").input_value() == "12345")
        submit(page)
        check("create: a space in the pseudo is refused", err(page, "pseudo") == "3 à 15 lettres, chiffres, - ou _")
        for easy in ("123456", "000000", "121212", "123321", "112233", "987654"):
            fill(page, pseudo="Sam", code=easy, code2=easy, promo="mapst-test")
            submit(page, wait=300)
            if err(page, "code") != "Trop facile à deviner. Choisis-en un autre.":
                break
        check("create: obvious codes refused (123456, 000000, 121212, 123321, 112233, 987654)",
              err(page, "code") == "Trop facile à deviner. Choisis-en un autre.")
        page.locator(f"{SHEET} [data-eye]").first.click()
        check("create: the eye shows the code", page.locator(f"{SHEET} [name='code']").get_attribute("type") == "text")
        fill(page, code="481930", code2="481931")
        submit(page)
        check("create: « Les deux codes sont différents. »", err(page, "code2") == "Les deux codes sont différents.")
        fill(page, code2="481930", promo="mauvais-code")
        submit(page, wait=900)
        check("create: a wrong class code is refused by the server, under its field",
              err(page, "promo") == "Ce code de la promo n'est pas bon. Demande-le à ton groupe.")
        check("create: … and the sign-in account is deleted again", "sam" not in srv(page)["users"])
        fill(page, pseudo="Prof", promo="mapst-test")
        submit(page, wait=900)
        check("create: « Ce pseudo est déjà pris. Si c'est le tien, connecte-toi. »",
              err(page, "pseudo") == "Ce pseudo est déjà pris. Si c'est le tien, connecte-toi.")
        ctx.set_offline(True)
        fill(page, pseudo="Sam")
        submit(page)
        check("create: offline → « Pas de connexion. Réessaie quand tu as du réseau. »",
              err(page, "general") == "Pas de connexion. Réessaie quand tu as du réseau.")
        ctx.set_offline(False)
        page.locator(f"{SHEET} [name='classement']").check()
        submit(page, wait=200)
        check("create: « Compte créé. Ta progression est sauvegardée. »", toast(page) == "Compte créé. Ta progression est sauvegardée.")
        page.wait_for_timeout(1500)
        s = srv(page)
        check("create: the sheet closes", page.locator(SHEET).count() == 0)
        check("create: the profile online, with the class code and the phone's progress",
              s["membres"]["sam"]["code"] == "mapst-test" and json.loads(s["membres"]["sam"]["progres"])["reviser"]["xp"] == 260)
        check("create: the classement line, with the XP of this week (160)", s["classement"].get("sam", {}).get("xp") == 160
              and s["classement"]["sam"]["semaine"] == WEEK)
        check("create: saved on the phone as { pseudo, cle, classement, sync }",
              {k: v for k, v in local(page, "compte").items() if k != "sync"} == {"pseudo": "Sam", "cle": "sam", "classement": True})
        text = norm(page.locator(f"{VISIBLE} .compte-list").inner_text())
        check("Profil signed in: the pseudo, « Sauvegardé à l'instant », the rows", all(t in text for t in [
            "Sam", "Sauvegardé à l'instant", "Apparaître dans le classement", "Classement de la semaine", "Changer mon code",
            "Me déconnecter", "Supprimer mon compte"]))
        check("Profil signed in: « Supprimer mon compte » in bougainvillier", page.locator(f"{VISIBLE} .compte-delete.tone-bougainvillier").count() == 1)
        check("Profil signed in: the switch is on", page.locator(f"{VISIBLE} [data-classement-switch]").is_checked())
        shot(page, "02-profil-light")

        # ---- The classement
        page.locator(f"{VISIBLE} [data-classement]").click()
        page.wait_for_timeout(1400)
        check("classement: from Profil, the page of Réviser", visible_path(page) == "reviser/classement")
        head = norm(page.locator(f"{VISIBLE} .page__body").inner_text())
        check("classement: « Classement » and « Cette semaine · remis à zéro lundi »", "Classement" in head and "Cette semaine · remis à zéro lundi" in head)
        rows = [norm(r.inner_text()) for r in page.locator(f"{VISIBLE} .classement__row").all()]
        check("classement: this week only, by XP then pseudo (Lea, Sam, Tom, Zoe; not Carl of last week)",
              [r.split(" ")[2] for r in rows] == ["Lea", "Sam", "Tom", "Zoe"])
        check("classement: rank, initial, pseudo, XP", rows and rows[0].startswith("1 L Lea") and rows[0].endswith("300 XP"))
        me = page.locator(f"{VISIBLE} .classement__row.is-me")
        check("classement: my row, turquoise, with « toi »", me.count() == 1 and "Sam toi" in norm(me.inner_text()))
        check("classement: the three first ranks in soleil, galet, bougainvillier",
              [page.locator(f"{VISIBLE} .classement__row").nth(i).get_attribute("class").split(" tone-")[1].split(" ")[0] for i in range(3)]
              == ["soleil", "galet", "bougainvillier"])
        check("classement: « Mis à jour à 18:0x »", norm(page.locator(f"{VISIBLE} .classement__when").inner_text()).startswith("Mis à jour à 18:0"))
        check("classement: the rows rise", page.locator(f"{VISIBLE} .classement__list.rises .rise").count() == 4)
        shot(page, "03-classement-light")
        page.locator(".tab[data-tab='reviser']").click()
        page.wait_for_timeout(900)
        page.locator(".tab[data-tab='reviser']").click()           # back to the first page of Réviser
        page.wait_for_timeout(900)
        page.locator(f"{VISIBLE} .hd [data-classement]").click()
        page.wait_for_timeout(1000)
        check("classement: a tap on the XP chip of Réviser opens it", visible_path(page) == "reviser/classement")
        page.go_back()
        page.wait_for_timeout(700)

        # ---- Hidden, then « Apparaître »
        go(page, "#accueil/profil")
        page.locator(f"{VISIBLE} [data-classement-switch]").uncheck()
        check("Profil: switch off → « Tu n'apparais plus dans le classement. »", toast(page) == "Tu n'apparais plus dans le classement.")
        page.wait_for_timeout(500)
        check("Profil: switch off deletes my line", "sam" not in srv(page)["classement"] and local(page, "compte")["classement"] is False)
        go(page, "#reviser/classement")
        page.wait_for_timeout(800)
        check("classement hidden: the banner « Tu n'apparais pas dans le classement. » and « Apparaître »",
              norm(page.locator(f"{VISIBLE} .glass-banner").inner_text()) == "Tu n'apparais pas dans le classement. Apparaître")
        check("classement hidden: my row is not there", page.locator(f"{VISIBLE} .classement__row.is-me").count() == 0)
        page.locator(f"{VISIBLE} [data-apparaitre]").click()
        page.wait_for_timeout(2200)
        check("classement: « Apparaître » writes my line again, and the banner goes",
              srv(page)["classement"].get("sam", {}).get("xp") == 160 and page.locator(f"{VISIBLE} .glass-banner").count() == 0
              and page.locator(f"{VISIBLE} .classement__row.is-me").count() == 1)

        # ---- Sam asks a question (deleted with the account at the end)
        go(page, "#cours/anatomie-mouvement")
        page.locator(f"{VISIBLE} [data-poser]").click()
        page.wait_for_selector(SHEET)
        page.wait_for_timeout(400)
        page.locator(f"{SHEET} textarea").fill("Le muscle agoniste, c'est celui qui raccourcit ?")
        submit(page, wait=200)
        toast(page)
        page.wait_for_timeout(500)

        # ---- Signing out
        go(page, "#accueil/profil")
        page.locator(f"{VISIBLE} [data-logout]").click()
        page.wait_for_selector(SHEET)
        page.wait_for_timeout(400)
        check("sign out: « Me déconnecter ? » and « Ta progression reste sur ce téléphone. »",
              "Me déconnecter ?" in sheet_text(page) and "Ta progression reste sur ce téléphone." in sheet_text(page))
        page.locator(f"{SHEET} [data-logout]").click()
        check("sign out: a toast", toast(page) == "À bientôt !")
        page.wait_for_timeout(600)
        check("sign out: Profil shows « Créer mon compte » again; the progress stays on the phone",
              page.locator(f"{VISIBLE} .compte-card").count() == 1 and local(page, "compte") is None and local(page, "reviser")["xp"] == 260)

        # ---- Signing in
        open_profil_sheet(page, "connecter")
        text = sheet_text(page)
        check("sign in: the sheet", all(t in text for t in ["Me connecter", "Pseudo", "Code à 6 chiffres", "Créer un compte",
                                                            "Code oublié ? Demande à l'admin de la promo : il peut t'en redonner un."]))
        fill(page, pseudo="Sam", code="999999")
        submit(page, wait=800)
        check("sign in: a wrong code → « Pseudo ou code incorrect. »", err(page, "code") == "Pseudo ou code incorrect.")
        fill(page, pseudo="bloque", code="102938")
        submit(page, wait=800)
        check("sign in: too many tries → « Trop d'essais. Réessaie dans quelques minutes. »",
              err(page, "general") == "Trop d'essais. Réessaie dans quelques minutes.")
        fill(page, pseudo="sam", code="481930")
        submit(page, wait=100)
        check("sign in: « Content de te revoir, Sam. » (the pseudo as typed at creation)", toast(page) == "Content de te revoir, Sam.")
        page.wait_for_timeout(1200)
        check("sign in: the classement switch comes back on (my line exists)", page.locator(f"{VISIBLE} [data-classement-switch]").is_checked())

        # ---- Changing the code
        page.locator(f"{VISIBLE} [data-code]").click()
        page.wait_for_selector(SHEET)
        page.wait_for_timeout(400)
        fill(page, ancien="111999", code="530718", code2="530718")
        submit(page, wait=800)
        check("change code: a wrong current code → « Code incorrect. »", err(page, "ancien") == "Code incorrect.")
        fill(page, ancien="481930", code="654321", code2="654321")
        submit(page)
        check("change code: an obvious new code is refused", err(page, "code") == "Trop facile à deviner. Choisis-en un autre.")
        fill(page, code="530718", code2="530718")
        submit(page, wait=100)
        check("change code: « Code changé. »", toast(page) == "Code changé." and srv(page)["users"]["sam"]["code"] == "530718")
        page.wait_for_timeout(600)

        # ---- Deleting the account
        page.locator(f"{VISIBLE} [data-delete]").click()
        page.wait_for_selector(SHEET)
        page.wait_for_timeout(400)
        text = sheet_text(page)
        check("delete: « Supprimer ton compte ? » and what is erased", "Supprimer ton compte ?" in text
              and "Ton pseudo, ta progression en ligne, ta place au classement et tes questions seront effacés. Ta progression reste sur ce téléphone." in text
              and "Supprimer définitivement" in text)
        fill(page, code="481930")
        submit(page, wait=800)
        check("delete: the old code → « Code incorrect. »", err(page, "code") == "Code incorrect.")
        check("delete: Sam's question is there before", any(q["auteur"] == "sam" for q in srv(page)["questions"].values()))
        fill(page, code="530718")
        submit(page, wait=100)
        check("delete: « Compte supprimé. »", toast(page) == "Compte supprimé.")
        page.wait_for_timeout(600)
        s = srv(page)
        check("delete: profile, classement line, questions and sign-in account erased online",
              "sam" not in s["membres"] and "sam" not in s["classement"] and "sam" not in s["users"]
              and not any(q["auteur"] == "sam" for q in s["questions"].values()))
        check("delete: the progress stays on the phone", local(page, "compte") is None and local(page, "reviser")["xp"] == 260)
        ctx.close()

        # ================================================================ 5. An account made without the class code
        ctx, page = phone("sans profil")
        go(page, "#accueil/profil")
        open_profil_sheet(page, "connecter")
        fill(page, pseudo="SansProfil", code="556677")
        submit(page, wait=900)
        check("no profile: after signing in, the « Code de la promo » field alone",
              page.locator(f"{SHEET} [name='promo']").count() == 1 and page.locator(f"{SHEET} [name='pseudo']").count() == 0)
        fill(page, promo="pas-le-bon")
        submit(page, wait=800)
        check("no profile: a wrong class code → the message under it", err(page, "promo") == "Ce code de la promo n'est pas bon. Demande-le à ton groupe.")
        fill(page, promo="mapst-test")
        submit(page, wait=100)
        check("no profile: done, « Content de te revoir, SansProfil. »", toast(page) == "Content de te revoir, SansProfil."
              and srv(page)["membres"]["sansprofil"]["code"] == "mapst-test")
        ctx.close()

        # ================================================================ 6. Sync: a new phone, a lesson read
        ctx, page = phone("nouveau téléphone", name="Léa")
        go(page, "#accueil/profil")
        open_profil_sheet(page, "connecter")
        fill(page, pseudo="Lea", code="839201")
        submit(page, wait=1500)
        check("sync: the progress of the account comes to the new phone", (local(page, "reviser") or {}).get("xp") == 500
              and (local(page, "lecons") or {}).get("fiche-de-seance-les-bases", {}).get("read") == "2026-11-12")
        page.locator(".tab[data-tab='reviser']").click()
        page.wait_for_timeout(900)
        check("sync: Réviser shows the XP of the account", "500 XP" in norm(page.locator(f"{VISIBLE} .hd__end").inner_text()))
        writes = len([x for x in srv(page)["log"] if x["op"] == "progres"])
        page.evaluate("""async () => {
          const s = await import('./js/core/storage.js');
          const all = JSON.parse(localStorage.getItem('promo-mapst:lecons'));
          all['filieres-les-trois'] = { at: 0, read: '2026-11-13' };
          s.save('lecons', all);
          window.dispatchEvent(new CustomEvent('progres-fini'));
        }""")
        page.wait_for_timeout(2500)
        check("sync: nothing sent at once (it waits 5 s to group changes)", len([x for x in srv(page)["log"] if x["op"] == "progres"]) == writes)
        page.wait_for_timeout(4000)
        online = json.loads(srv(page)["membres"]["lea"]["progres"])
        check("sync: 5 s after a finished lesson, the progress is saved online", "filieres-les-trois" in online["lecons"]
              and online["reviser"]["xp"] == 500)
        # Close and open again: still signed in, nothing to send, nothing written.
        writes = len([x for x in srv(page)["log"] if x["op"] == "progres"])
        page.close()
        page = ctx.new_page()
        watch(page, "rouvert")
        go(page, "#accueil/profil")
        page.wait_for_timeout(2000)
        check("reopened: still signed in", "Lea" in norm(page.locator(f"{VISIBLE} .compte-list").inner_text()))
        check("reopened: the launch sync writes nothing when nothing changed", len([x for x in srv(page)["log"] if x["op"] == "progres"]) == writes)

        # ================================================================ 7. Questions de la promo (Lea)
        page.locator(".tab[data-tab='cours']").click()
        page.wait_for_timeout(900)
        check("questions: the glass button « Poser une question » in the header of Cours",
              norm(page.locator(f"{VISIBLE} .hd [data-poser]").inner_text()) == "Poser une question")
        check("questions: the row « Questions de la promo » at the top of the path",
              page.locator(f"{VISIBLE} .body > .cours-questions:first-child [data-questions]").count() == 1)
        page.locator(f"{VISIBLE} [data-questions]").click()
        page.wait_for_timeout(1200)
        check("questions: the list is a page of Cours", visible_path(page) == "cours/questions")
        cards = page.locator(f"{VISIBLE} .qcard")
        check("questions: two cards, newest first", cards.count() == 2 and cards.nth(0).get_attribute("data-question") == "q1")
        first = norm(cards.nth(0).inner_text())
        check("questions: a card has the text, the pseudo, « il y a 2 j », the chapter, « En attente », « Moi aussi · 1 »",
              "Quelle est la différence" in first and "Lea · il y a 2 j" in first and "La fiche de séance" in first
              and "En attente" in first and "Moi aussi · 1" in first)
        check("questions: three lines at most", page.locator(f"{VISIBLE} .qcard__text").first.evaluate("e => getComputedStyle(e).webkitLineClamp") == "3")
        check("questions: an answered one says « Répondu »", "Répondu" in norm(cards.nth(1).inner_text()))
        check("questions: « Toutes » / « Sans réponse » (no « À répondre » for a classmate)",
              [norm(b.inner_text()) for b in page.locator(f"{VISIBLE} .seg__btn").all()] == ["Toutes", "Sans réponse"])
        shot(page, "04-questions-light")
        page.locator(f"{VISIBLE} [data-filter='sans']").click()
        page.wait_for_timeout(300)
        check("questions: « Sans réponse » keeps the one without an answer", page.locator(f"{VISIBLE} .qcard").count() == 1)
        page.locator(f"{VISIBLE} [data-filter='toutes']").click()
        page.wait_for_timeout(300)
        page.locator(f"{VISIBLE} [data-question='q2']").click()
        page.wait_for_selector(SHEET)
        page.wait_for_timeout(500)
        text = sheet_text(page)
        check("a question: the text, who and when, the answer and its date",
              "On a combien de temps pour rendre le dossier du stage ?" in text and "Tom · il y a 5 j" in text
              and "Réponse" in text and "Trois semaines après la fin du stage." in text and "le 9 novembre" in text)
        check("a question: the text can be selected", page.locator(f"{SHEET} .qsheet__text").evaluate("e => getComputedStyle(e).userSelect") == "text")
        shot(page, "05-question-light")
        page.locator(f"{SHEET} [data-aussi]").click()
        page.wait_for_timeout(700)
        check("« Moi aussi »: on, saved online, « Moi aussi · 1 »", srv(page)["questions"]["q2"]["aussi"] == ["lea"]
              and page.locator(f"{SHEET} [data-aussi]").get_attribute("aria-pressed") == "true"
              and "Moi aussi · 1" in norm(page.locator(f"{SHEET} [data-aussi]").inner_text()))
        page.locator(f"{SHEET} [data-aussi]").click()
        page.wait_for_timeout(700)
        check("« Moi aussi »: off again", srv(page)["questions"]["q2"]["aussi"] == [])
        page.go_back()
        page.wait_for_timeout(600)
        page.locator(f"{VISIBLE} [data-question='q1']").click()
        page.wait_for_selector(SHEET)
        page.wait_for_timeout(500)
        check("my question: no « Moi aussi », « Pas encore de réponse. », « Supprimer ma question »",
              page.locator(f"{SHEET} [data-aussi]").count() == 0 and "Pas encore de réponse." in sheet_text(page)
              and "Supprimer ma question" in sheet_text(page))
        page.locator(f"{SHEET} [data-chapitre]").click()
        page.wait_for_timeout(1200)
        check("a question: its chapter opens the chapter", visible_path(page) == "cours/fiche-de-seance")
        # Asking from a chapter (it carries the chapter)
        page.locator(f"{VISIBLE} .chapter__ask [data-poser]").click()
        page.wait_for_selector(SHEET)
        page.wait_for_timeout(500)
        text = sheet_text(page)
        check("ask: the sheet (placeholder, counter, chapter pre-filled, who sees it)",
              page.locator(f"{SHEET} textarea").get_attribute("placeholder") == "Ta question, comme tu la poserais en cours"
              and "0/500" in text and "Toute la promo verra ta question avec ton pseudo." in text
              and page.locator(f"{SHEET} select").input_value() == "fiche-de-seance")
        check("ask: « Envoyer » waits for 3 characters", page.locator(f"{SHEET} [type=submit]").is_disabled())
        page.locator(f"{SHEET} textarea").fill("Un exemple d'objectif opérationnel pour des 8-10 ans ?")
        check("ask: the counter follows", "54/500" in sheet_text(page))
        ctx.set_offline(True)
        submit(page, wait=500)
        check("ask offline: « Pas de connexion… », the text stays",
              "Pas de connexion. Réessaie quand tu as du réseau." in sheet_text(page)
              and page.locator(f"{SHEET} textarea").input_value().startswith("Un exemple d'objectif"))
        ctx.set_offline(False)
        submit(page, wait=100)
        check("ask: « Question envoyée. »", toast(page) == "Question envoyée.")
        page.wait_for_timeout(500)
        asked = [q for q in srv(page)["questions"].values() if q["texte"].startswith("Un exemple d'objectif")]
        check("ask: saved online with the chapter, my pseudo, no answer", len(asked) == 1 and asked[0]["chapitre"] == "fiche-de-seance"
              and asked[0]["auteur"] == "lea" and asked[0]["pseudo"] == "Lea" and asked[0]["reponse"] == "" and asked[0]["aussi"] == [])
        # Deleting my own question (two taps)
        go(page, "#cours/questions")
        page.wait_for_timeout(800)
        page.locator(f"{VISIBLE} [data-question='q1']").click()
        page.wait_for_selector(SHEET)
        page.wait_for_timeout(400)
        page.locator(f"{SHEET} [data-delete]").click()
        page.wait_for_timeout(200)
        check("delete my question: the first tap asks", "Touche encore pour supprimer" in sheet_text(page) and "q1" in srv(page)["questions"])
        page.locator(f"{SHEET} [data-delete]").click()
        check("delete my question: « Question supprimée. »", toast(page) == "Question supprimée.")
        page.wait_for_timeout(500)
        check("delete my question: gone online and from the list", "q1" not in srv(page)["questions"]
              and page.locator(f"{VISIBLE} [data-question='q1']").count() == 0)
        # Offline: the last list stays, with when it was read
        ctx.set_offline(True)
        page.locator(f"{VISIBLE} [data-refresh]").click()
        page.wait_for_timeout(600)
        when = norm(page.locator(f"{VISIBLE} .classement__when").inner_text())
        check("questions offline: the saved list, « Mis à jour à … · Pas de connexion… »",
              page.locator(f"{VISIBLE} .qcard").count() >= 2 and when.startswith("Mis à jour à") and "Pas de connexion" in when)
        page.evaluate("location.hash = '#reviser/classement'")     # inside the app (no reload offline)
        page.wait_for_timeout(1200)
        check("classement offline: the saved list (or the message), never empty",
              page.locator(f"{VISIBLE} .classement__row").count() >= 3 or "Pas de connexion" in norm(page.locator(VISIBLE).inner_text()))
        ctx.set_offline(False)
        ctx.close()

        # ================================================================ 8. The admin
        ctx, page = phone("admin", signed_in=("Prof", False))
        go(page, "#cours/questions")
        page.wait_for_timeout(1500)
        check("admin: « À répondre » first, and chosen", [norm(b.inner_text()) for b in page.locator(f"{VISIBLE} .seg__btn").all()]
              == ["À répondre", "Toutes", "Sans réponse"] and page.locator(f"{VISIBLE} [data-filter='arepondre']").get_attribute("aria-checked") == "true")
        check("admin: « À répondre » has the questions without an answer", page.locator(f"{VISIBLE} .qcard").count() == 1)
        page.locator(f"{VISIBLE} [data-question='q1']").click()
        page.wait_for_selector(SHEET)
        page.wait_for_timeout(600)
        check("admin: « Ta réponse » and « Publier la réponse »", page.locator(f"{SHEET} textarea[name='reponse']").count() == 1
              and norm(page.locator(f"{SHEET} .qsheet__admin [type=submit]").inner_text()) == "Publier la réponse"
              and page.locator(f"{SHEET} textarea[name='reponse']").get_attribute("maxlength") == "2000")
        page.locator(f"{SHEET} textarea[name='reponse']").fill("Le général dit où tu vas sur le cycle ; l'opérationnel dit ce que le pratiquant saura faire à la fin de la séance, de façon observable.")
        page.locator(f"{SHEET} .qsheet__admin [type=submit]").click()
        check("admin: « Réponse publiée. »", toast(page) == "Réponse publiée.")
        page.wait_for_timeout(500)
        check("admin: the answer is online, and the button says « Modifier la réponse »",
              srv(page)["questions"]["q1"]["reponse"].startswith("Le général dit")
              and norm(page.locator(f"{SHEET} .qsheet__admin [type=submit]").inner_text()) == "Modifier la réponse")
        page.locator(f"{SHEET} [data-delete]").click()
        page.wait_for_timeout(150)
        page.locator(f"{SHEET} [data-delete]").click()
        check("admin: « Supprimer la question » (two taps)", toast(page) == "Question supprimée.")
        page.wait_for_timeout(400)
        check("admin: deleted online", "q1" not in srv(page)["questions"])
        ctx.close()

        # ================================================================ 9. Not signed in: questions and classement
        ctx, page = phone("pas de compte")
        go(page, "#cours")
        page.locator(f"{VISIBLE} .hd [data-poser]").click()
        page.wait_for_selector(SHEET)
        page.wait_for_timeout(400)
        check("ask without an account: « Il faut un compte pour poser une question. » and the two buttons",
              "Il faut un compte pour poser une question." in sheet_text(page)
              and page.locator(f"{SHEET} [data-compte]").count() == 2)
        page.locator(f"{SHEET} [data-compte='connecter']").click()
        page.wait_for_timeout(900)
        check("… « J'ai déjà un compte » opens the sign-in sheet", "Me connecter" in sheet_text(page))
        page.go_back()
        page.wait_for_timeout(500)
        go(page, "#reviser/classement")
        text = norm(page.locator(VISIBLE).inner_text())
        check("classement without an account: « Le classement de la promo », « Crée ton compte pour voir où tu en es. »",
              "Le classement de la promo" in text and "Crée ton compte pour voir où tu en es." in text
              and page.locator(f"{VISIBLE} [data-compte='creer']").count() == 1)
        go(page, "#cours/questions")
        check("questions without an account: an empty state and the two buttons", page.locator(f"{VISIBLE} .questions__empty [data-compte]").count() == 2)
        ctx.close()

        # ================================================================ 10. Caps on what is sent to the classement
        ctx, page = phone("plafonds", storage={"promo-mapst:reviser": json.dumps(progress(5000, {"2026-11-13": {"xp": 5000, "done": 30}})[0])})
        go(page, "#accueil/profil")
        open_profil_sheet(page, "creer")
        fill(page, pseudo="Max", code="481930", code2="481930", promo="mapst-test")
        page.locator(f"{SHEET} [name='classement']").check()
        submit(page, wait=1800)
        scores = [x["xp"] for x in srv(page)["log"] if x["op"] == "score" and x["cle"] == "max"]
        check("caps: the first line is 3 000 at most (5 000 XP this week)", scores == [3000])
        page.wait_for_timeout(16500)
        scores = [x["xp"] for x in srv(page)["log"] if x["op"] == "score" and x["cle"] == "max"]
        check("caps: the rest at the next sync, +400 at most (3 400)", scores[:2] == [3000, 3400])
        ctx.close()

        # ================================================================ 11. Dark mode
        ctx, page = phone("sombre", scheme="dark", signed_in=("Lea", True),
                          storage={"promo-mapst:reviser": json.dumps(LEA_REVISER), "promo-mapst:lecons": json.dumps(LEA_LECONS)})
        go(page, "#accueil/profil")
        page.wait_for_timeout(800)
        shot(page, "02-profil-dark")
        go(page, "#reviser/classement")
        page.wait_for_timeout(1200)
        shot(page, "03-classement-dark")
        go(page, "#cours/questions")
        page.wait_for_timeout(1200)
        shot(page, "04-questions-dark")
        page.locator(f"{VISIBLE} [data-question='q2']").click()
        page.wait_for_timeout(800)
        shot(page, "05-question-dark")
        page.go_back()
        page.wait_for_timeout(500)
        page.evaluate("localStorage.removeItem('promo-mapst:compte'); localStorage.removeItem('faux-backend:session')")
        go(page, "#accueil/profil")
        open_profil_sheet(page, "creer")
        shot(page, "01-creer-dark")
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
