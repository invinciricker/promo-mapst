#!/usr/bin/env python3
"""
Export the class planning for the Promo MAPST app.

WHAT IT DOES
    Reads two files from the PRIVATE repository (invinciricker/Claude-timetable-artefact):
        private/data/planning.json   the official CAPA Sports planning (version of 1 Oct 2026)
        private/data/content.json    labels, corrections, stages of the year, key dates, holidays
    and writes two files in THIS (public) repository:
        content/planning.json        what the app shows
        content/planning.ics         the same planning, for Google Calendar or Apple Calendar

    Only what applies to the whole class is exported. Everything personal stays private:
    names, contacts, addresses, the personal stage, personal events. Trainers appear as
    initials only. Nothing else is ever copied from the private repository (no PDF, no photo).

HOW TO RUN IT (from the folder of this repository)
    python3 scripts/export_planning.py ../Claude-timetable-artefact

    The path is where you cloned the private repository. Without a path, the script looks
    for a folder called Claude-timetable-artefact next to this repository.

SAFETY NET
    Before writing anything, the script searches its own output for personal data it knows
    about (names and first names from the private files, phone numbers, addresses...).
    If it finds any, it stops and writes nothing.

Needs Python 3.8 or newer, nothing to install.
"""

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # this repository
OUT_JSON = ROOT / "content" / "planning.json"
OUT_ICS = ROOT / "content" / "planning.ics"

# Date of the official planning PDF the private planning.json was parsed from.
# Change it (or pass --planning-date) when you export a newer planning.
PLANNING_DATE = "2026-10-01"

# "Who" labels that are not people: they are kept as they are written.
# Everything else in the "who" column is a person and becomes initials.
LABELS = {"ville de nice", "evaluateurs", "equipe capa", "formateurs", "staff"}

# The categories of the app. The names (Azur, Olivier...) and most descriptions come from
# content.json ("cats"). Corail (the personal stage) is not exported. Lavande was the
# personal stage meetings: in the class planning it marks the preparation of the épreuves.
CATEGORY_FROM = {            # app category -> category in content.json
    "cours": "formation",
    "prepa": "reunion",
    "centre": "centre",
    "epreuve": "certif",
    "libre": "off",
    "perso": "perso",
}
CATEGORY_TEXT = {            # labels written for the class version (override content.json)
    "prepa": ("Préparation", "Préparation des épreuves et des rattrapages"),
    "centre": ("Centre de loisirs", "Mercredis et périodes MSP au centre de loisirs, avec la Ville de Nice"),
    "perso": ("Perso", "Ce que tu ajoutes avec « + », gardé sur ce téléphone"),
}

HALF_NAMES = {"am": "Matin", "pm": "Après-midi"}
FREE_TITLES = {"am": "Matinée libre", "pm": "Après-midi libre"}


# --------------------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------------------

def strip_accents(text):
    """'Évaluateurs' -> 'Evaluateurs'."""
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def norm(text):
    """Lower case, no accents, single spaces: used to compare texts."""
    return re.sub(r"\s+", " ", strip_accents(text).lower()).strip()


def to_date(iso):
    y, m, d = map(int, iso.split("-"))
    return date(y, m, d)


def hhmm(text):
    """'9H00' -> '09:00', '13H' -> '13:00'."""
    h, m = text.upper().strip().split("H")
    return f"{int(h):02d}:{int(m or 0):02d}"


def fail(message):
    sys.exit("\nSTOPPED: " + message + "\nNothing was written.\n")


# --------------------------------------------------------------------------------------
# Trainers -> initials
# --------------------------------------------------------------------------------------

def first_names_by_surname(content):
    """Known first names, found in the private files: {'dupont': {'Jeanne', 'Marc'}, ...}
    (made-up example). Used to turn a surname alone (MARTIN) into full initials (L.M.)."""
    found = defaultdict(set)
    names = [p.get("name", "") for p in content.get("people", [])] + list(content.get("whoMap", {}).values())
    for name in names:
        for part in re.split(r"\s*[+/]\s*", name):
            words = part.split()
            if len(words) == 2 and norm(part) not in LABELS:
                found[norm(words[1])].add(words[0])
    return found


def initials(person, first_names):
    """'Jeanne Dupont' -> 'J.D.'   'DUPONT Jeanne' -> 'J.D.'   'Martin' -> 'L.M.' (if the first
    name is known) or 'M.'"""
    words = [w for w in re.split(r"[\s.]+", person) if w]
    if not words:
        return ""
    if len(words) == 1:
        known = first_names.get(norm(words[0]), set())
        if len(known) == 1:
            words = [next(iter(known)), words[0]]
    else:
        # The planning writes "SURNAME Firstname": put the first name first.
        caps = [w for w in words if w.isupper() and len(w) > 1]
        rest = [w for w in words if w not in caps]
        if caps and rest:
            words = rest + caps
    return "".join(w[0].upper() + "." for w in words)


def who_for_class(raw, content, first_names, seen):
    """The 'who' cell of the planning, made public: labels kept, people -> initials."""
    if not raw:
        return ""
    shown = content.get("whoMap", {}).get(raw, raw)
    parts = []
    for part in re.split(r"\s*[+/]\s*", shown):
        if not part:
            continue
        if norm(part) in LABELS:
            parts.append(part if not part.isupper() else part.title())
        else:
            parts.append(initials(part, first_names))
    result = " + ".join(parts)
    seen[raw] = result
    return result


# --------------------------------------------------------------------------------------
# Topics
# --------------------------------------------------------------------------------------

def describe_topic(raw, place_id, weekday, content, unknown):
    """Returns (category, short title, full title, note) for the topic of a half-day."""
    q = raw.strip()
    n = norm(q)

    msp = re.fullmatch(r"msp\s*(\d)?", n)
    if msp:
        num = msp.group(1)
        if place_id == "centre":
            if num:
                return "centre", f"MSP {num}", f"MSP {num} au centre de loisirs", None
            if weekday == 2:
                return "centre", "Centre", "Mercredi au centre de loisirs", None
            return "centre", "Centre", "Centre de loisirs", None
        label = f"MSP {num}" if num else "MSP"
        return "cours", label, label, "Le planning indique « " + label + " » ici, sans détail."

    if n.startswith("prepa"):                       # Préparation BC3, PREPARATION RATTRAPAGES...
        category = "prepa"
    elif n == "epmsp" or n.startswith("rattrapage") or "certification" in n:
        category = "epreuve"
    else:
        category = "cours"

    topics = content.get("topics", {})
    if q in topics:
        short, title = topics[q]
    else:
        unknown.add(q)
        short, title = (q[:22] + "…") if len(q) > 23 else q, q
    return category, short, title, None


# --------------------------------------------------------------------------------------
# Personal data detector (the safety net)
# --------------------------------------------------------------------------------------

def personal_tokens(content):
    """Words and phrases that must never appear in the public files, built from the private
    files themselves (so this script never contains a name)."""
    words, phrases = set(), set()

    def add_name(name):
        for w in re.split(r"[\s,.'’()+/-]+", name):
            if len(w) >= 3 and norm(w) not in {"autres", "intervenants", "ville", "nice", "evaluateurs", "equipe", "capa", "formateurs", "staff", "des", "les"}:
                words.add(norm(w))

    meta = content.get("meta", {})
    if meta.get("name"):
        add_name(meta["name"])
    for person in content.get("people", []):
        add_name(person.get("name", ""))
    for raw, shown in content.get("whoMap", {}).items():
        for part in re.split(r"\s*[+/]\s*", shown) + re.split(r"\s*[+/]\s*", raw):
            if norm(part) not in LABELS:
                add_name(part)

    an = content.get("animanice") or {}
    if an:
        phrases.add("animanice")
        for slot_list in an.get("template", {}).values():
            for slot in slot_list:
                place = content.get("places", {}).get(slot.get("p"), {})
                if place.get("name"):
                    phrases.add(norm(place["name"]))
    recre = content.get("recre") or {}
    if recre.get("name"):
        phrases.add(norm(recre["name"]))
    for place in content.get("places", {}).values():
        for key in ("addr", "map"):
            if place.get(key):
                phrases.add(norm(place[key]))
    return words, phrases


PATTERNS = [
    (re.compile(r"\b0\d(?:[ .]?\d\d){4}\b"), "a phone number"),
    (re.compile(r"\b\d+,?\s+(?:avenue|av\.|boulevard|bd|rue|chemin|allee|place|impasse)\b", re.I), "a street address"),
    (re.compile(r"\b06\d{3}\b"), "a postcode"),
    (re.compile(r"\b(?:ton|ta|tes)\s", re.I), "text written about you (ton/ta/tes)"),
]


def find_personal(text, words, phrases, about_you=False):
    """Returns a list of problems found in a public text.
    about_you=True also refuses texts written about you (ton/ta/tes): used for the notes taken
    from content.json, not for the texts written by this script."""
    plain = norm(text)
    problems = []
    for w in sorted(words):
        if re.search(r"\b" + re.escape(w) + r"\b", plain):
            problems.append(f"the word '{w}'")
    for p in sorted(phrases):
        if p and p in plain:
            problems.append(f"the phrase '{p}'")
    for pattern, what in PATTERNS:
        if what.startswith("text written about you") and not about_you:
            continue
        m = pattern.search(plain)
        if m:
            problems.append(f"{what} ('{m.group(0)}')")
    return problems


# --------------------------------------------------------------------------------------
# Build the class planning
# --------------------------------------------------------------------------------------

def build(planning, content, planning_date):
    problems, unknown_topics, who_seen = [], set(), {}
    first_names = first_names_by_surname(content)
    holidays = content.get("holidays", {})
    places = content.get("places", {})
    place_ids = content.get("lieuMap", {})
    cell_notes = content.get("cellNotes", {})
    days, weeks = {}, {}
    page_index = defaultdict(int)
    hidden_by_holiday = []      # half-days of the planning replaced by a public holiday

    for row in planning:
        page, src = row["page"], row["date_src"]
        fix = content.get("pageFix", {}).get(str(page))
        if fix:                                          # e.g. page 13 says 11/2026 for 12/2026
            src = src.replace(fix["from"], fix["to"])
        dd, mm, yy = map(int, src.split("/"))
        day = date(yy, mm, dd)
        position = page_index[page]
        page_index[page] += 1
        if day.weekday() != position:
            problems.append(f"page {page}: {src} is not day {position + 1} of its week")
        key = day.isoformat()
        monday = (day - timedelta(days=day.weekday())).isoformat()
        weeks[monday] = page

        slots = []
        for half in ("am", "pm"):
            cell = row[half]
            raw, raw_place, raw_who = cell["quoi"].strip(), cell["lieu"].strip(), cell["who"].strip()
            start, end = (hhmm(x) for x in cell["h"].split("/"))
            if raw in ("FERIE", "PONT"):
                if key not in holidays:
                    problems.append(f"{key}: the planning says {raw} but it is not in content.json holidays")
                continue
            if raw in ("OFF", ""):
                slot = {"half": half, "start": start, "end": end, "cat": "libre",
                        "short": "Libre", "title": FREE_TITLES[half], "free": True}
                if raw == "" and half == "pm" and row["am"]["quoi"].strip():
                    slot["note"] = "Après-midi vide dans le planning (sûrement libre)."
                    slot["check"] = True
                slots.append(slot)
                continue

            place_id = place_ids.get(raw_place, "")
            category, short, title, note = describe_topic(raw, place_id, day.weekday(), content, unknown_topics)
            slot = {"half": half, "start": start, "end": end, "cat": category, "short": short, "title": title}
            if norm(raw) != norm(title):
                slot["planning"] = raw                   # the exact words of the official planning
            if place_id and places.get(place_id, {}).get("name"):
                slot["place"] = places[place_id]["name"]
            elif raw_place:
                slot["place"] = raw_place
            who = who_for_class(raw_who, content, first_names, who_seen)
            if who:
                slot["who"] = who
            notes = [note] if note else []
            if not raw_place:
                guess = " (sûrement le CAL Nice)" if category in ("cours", "prepa") else ""
                notes.append("Lieu non précisé dans le planning" + guess + ".")
                slot["check"] = True
            if cell_notes.get(f"{key}|{half}"):
                notes.append(cell_notes[f"{key}|{half}"])
                slot["check"] = True
            if notes:
                slot["note"] = " ".join(notes)
            slots.append(slot)
        days[key] = {"week": page, "slots": slots}

    # Christmas break (and any other break with no training)
    for brk in content.get("breaks", []):
        d = to_date(brk["s"])
        while d <= to_date(brk["e"]):
            if d.weekday() < 5:
                days.setdefault(d.isoformat(), {"slots": []})["vacation"] = brk["t"]
            d += timedelta(days=1)

    # Public holidays win over the planning (e.g. 11 Nov: the planning says MSP).
    for key, name in sorted(holidays.items()):
        day = days.setdefault(key, {"slots": []})
        lessons = [s for s in day["slots"] if not s.get("free")]
        if lessons:
            hidden_by_holiday.append((key, name, sorted({s.get("planning", s["title"]) for s in lessons})))
        day["slots"] = []
        day["holiday"] = name
        if to_date(key).weekday() >= 5:
            problems.append(f"holiday {key} falls on a weekend")

    numbered = sorted(set(weeks.values()))
    if numbered != list(range(1, len(numbered) + 1)):
        problems.append(f"training weeks are not numbered 1..n: {numbered}")
    if problems:
        fail("the planning does not look right:\n  " + "\n  ".join(problems))

    return days, weeks, unknown_topics, who_seen, hidden_by_holiday


def class_texts(content, words, phrases, dropped):
    """Stages of the year, key dates, notes and sources: personal items are dropped."""

    def is_personal(*texts):
        return bool(find_personal(" ".join(t for t in texts if t), words, phrases, about_you=True))

    cat_map = {v: k for k, v in CATEGORY_FROM.items()}

    stages = []
    for ph in content.get("phases", []):
        if ph.get("c") == "stage" or is_personal(ph.get("t"), ph.get("sub")):
            dropped.append(f"stage of the year « {ph['t']} » ({ph['s']} → {ph['e']}): personal")
            stages.append({"start": ph["s"], "end": ph["e"], "personal": True})
            continue
        stages.append({"start": ph["s"], "end": ph["e"], "title": ph["t"], "text": ph.get("sub", ""),
                       "cat": cat_map.get(ph.get("c"), "cours")})

    key_dates = []
    for k in content.get("keys", []):
        if k.get("c") == "stage" or is_personal(k.get("t")):
            dropped.append(f"key date « {k['t']} » ({k['d']}): personal")
            continue
        item = {"date": k["d"], "title": k["t"], "cat": cat_map.get(k.get("c"), "cours")}
        if k.get("e"):
            item["end"] = k["e"]
        if k.get("exam"):
            item["kind"] = "epreuve"
        elif k.get("mark"):
            item["kind"] = "dossier"
        elif k.get("c") == "off":
            item["kind"] = "conge"
        else:
            item["kind"] = "etape"
        if k.get("src") == "cal":
            item["note"] = "D’après le calendrier de la formation (déc. 2025) : à confirmer avec CAPA."
        key_dates.append(item)

    checks = []
    for f in content.get("flags", []):
        if is_personal(f.get("t"), f.get("d")):
            dropped.append(f"note « {f['t']} »: personal")
            continue
        checks.append({"title": f["t"], "text": f["d"]})

    sources = []
    for s in content.get("meta", {}).get("sources", []):
        if is_personal(s) or re.search(r"gmail|agenda|photo", s, re.I):
            dropped.append(f"source « {s} »: personal")
            continue
        sources.append(re.sub(r"\s*\([^)]*Drive[^)]*\)", "", s))
    return stages, key_dates, checks, sources


def fill_personal_stages(stages, days):
    """A personal stage (2 → 20 Nov) is replaced by what the official planning says."""
    out = []
    for st in stages:
        if not st.get("personal"):
            out.append(st)
            continue
        counter = Counter()
        for key, day in days.items():
            if st["start"] <= key <= st["end"]:
                for s in day.get("slots", []):
                    if not s.get("free"):
                        counter[(s["short"], s.get("who", ""), s.get("place", ""), s["cat"])] += 1
        if not counter:
            continue
        (short, who, place, cat), _ = counter.most_common(1)[0]
        title = short + (" · " + who if who else "")
        text = "D’après le planning officiel : " + short + (" au " + place[0].lower() + place[1:] if place else "") \
            + (", avec la " + who if who == "Ville de Nice" else "") + "."
        out.append({"start": st["start"], "end": st["end"], "title": title, "text": text, "cat": cat})
    return out


def holiday_checks(hidden_by_holiday):
    """Notes for public holidays that replace classes of the planning (e.g. 11 November)."""
    days_fr = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
    months_fr = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
                 "septembre", "octobre", "novembre", "décembre"]
    out = []
    for key, name, shorts in hidden_by_holiday:
        d = to_date(key)
        out.append({"title": f"{days_fr[d.weekday()]} {d.day} {months_fr[d.month - 1]}",
                    "text": f"Le planning indique « {' / '.join(shorts)} », mais c’est un jour férié ({name}). "
                            "Affiché comme férié.",
                    "date": key})
    return out


# --------------------------------------------------------------------------------------
# Calendar file (.ics)
# --------------------------------------------------------------------------------------

def ics_escape(text):
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def ics_fold(line):
    """Lines longer than 75 bytes are folded (RFC 5545)."""
    out, current = [], ""
    for ch in line:
        if len((current + ch).encode("utf-8")) > 74:
            out.append(current)
            current = " " + ch
        else:
            current += ch
    out.append(current)
    return "\r\n".join(out)


def build_ics(data, categories):
    # Same stamp for every event: the day of the export (stable, so re-running the script on
    # the same day gives exactly the same file).
    stamp = data["source"]["exported"].replace("-", "") + "T000000Z"
    footer = "Planning MAPST de CAPA Sports du " + data["source"]["planningDateLabel"] \
        + ". Appli non officielle Promo MAPST : en cas de doute, vérifie dans tes cours."
    label = {c["id"]: c["label"] for c in categories}
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Promo MAPST//Planning BPJEPS MAPST//FR",
        "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Promo MAPST",
        "X-WR-CALDESC:" + ics_escape("Planning du BPJEPS MAPST 2026-2027 (CAPA Sports, Nice)"),
        "X-WR-TIMEZONE:Europe/Paris", "REFRESH-INTERVAL;VALUE=DURATION:PT12H", "X-PUBLISHED-TTL:PT12H",
        "BEGIN:VTIMEZONE", "TZID:Europe/Paris",
        "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST",
        "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
        "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET",
        "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
        "END:VTIMEZONE",
    ]

    def event(uid, summary, start, end, all_day, location="", description=""):
        ev = ["BEGIN:VEVENT", f"UID:{uid}@promo-mapst", f"DTSTAMP:{stamp}"]
        if all_day:
            ev += [f"DTSTART;VALUE=DATE:{start}", f"DTEND;VALUE=DATE:{end}", "TRANSP:TRANSPARENT"]
        else:
            ev += [f"DTSTART;TZID=Europe/Paris:{start}", f"DTEND;TZID=Europe/Paris:{end}"]
        ev.append("SUMMARY:" + ics_escape(summary))
        if location:
            ev.append("LOCATION:" + ics_escape(location))
        if description:
            ev.append("DESCRIPTION:" + ics_escape(description))
        ev.append("END:VEVENT")
        lines.extend(ev)

    compact = lambda iso: iso.replace("-", "")
    for key in sorted(data["days"]):
        day = data["days"][key]
        if day.get("holiday"):
            nxt = (to_date(key) + timedelta(days=1)).isoformat()
            event(f"{key}-ferie", "Férié · " + day["holiday"], compact(key), compact(nxt), True,
                  description="Pas de formation. " + footer)
        for s in day.get("slots", []):
            if s.get("free"):
                continue
            desc = [label.get(s["cat"], "")]
            if s.get("who"):
                desc.append("Avec : " + s["who"])
            if s.get("note"):
                desc.append("À vérifier : " + s["note"])
            desc.append(footer)
            event(f"{key}-{s['half']}", s["title"],
                  compact(key) + "T" + s["start"].replace(":", "") + "00",
                  compact(key) + "T" + s["end"].replace(":", "") + "00",
                  False, s.get("place", ""), "\n".join(d for d in desc if d))

    for brk in data["breaks"]:
        nxt = (to_date(brk["end"]) + timedelta(days=1)).isoformat()
        event(f"{brk['start']}-vacances", brk["title"] + " · pas de formation",
              compact(brk["start"]), compact(nxt), True, description=footer)
    for k in data["keyDates"]:
        if k["kind"] == "dossier":
            nxt = (to_date(k["date"]) + timedelta(days=1)).isoformat()
            event(f"{k['date']}-dossier", k["title"], compact(k["date"]), compact(nxt), True,
                  description=(k.get("note", "") + " " + footer).strip())

    lines.append("END:VCALENDAR")
    return "\r\n".join(ics_fold(line) for line in lines) + "\r\n"


# --------------------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Export the class planning for the Promo MAPST app.")
    parser.add_argument("private_repo", nargs="?", default=str(ROOT.parent / "Claude-timetable-artefact"),
                        help="folder of the private repository Claude-timetable-artefact")
    parser.add_argument("--planning-date", default=PLANNING_DATE, help="date of the official planning (YYYY-MM-DD)")
    parser.add_argument("--check", action="store_true", help="build and check, but write nothing")
    args = parser.parse_args()

    private = Path(args.private_repo).expanduser().resolve()
    planning_file = private / "private" / "data" / "planning.json"
    content_file = private / "private" / "data" / "content.json"
    for f in (planning_file, content_file):
        if not f.is_file():
            fail(f"cannot find {f}.\nGive the folder of the private repository, for example:\n"
                 "  python3 scripts/export_planning.py ../Claude-timetable-artefact")
    if private == ROOT or ROOT in private.parents:
        fail("the private repository must not be inside this public repository.")

    planning = json.loads(planning_file.read_text(encoding="utf-8"))
    content = json.loads(content_file.read_text(encoding="utf-8"))
    words, phrases = personal_tokens(content)
    dropped = []

    days, weeks, unknown_topics, who_seen, hidden_by_holiday = build(planning, content, args.planning_date)
    stages, key_dates, checks, sources = class_texts(content, words, phrases, dropped)
    stages = fill_personal_stages(stages, days)
    checks = holiday_checks(hidden_by_holiday) + checks

    months_fr = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
                 "septembre", "octobre", "novembre", "décembre"]
    pd = to_date(args.planning_date)
    cats = content.get("cats", {})
    categories = []
    for app_id, private_id in CATEGORY_FROM.items():
        src = cats.get(private_id, {})
        label, desc = CATEGORY_TEXT.get(app_id, (src.get("label", app_id), src.get("desc", "")))
        categories.append({"id": app_id, "name": src.get("name", app_id), "label": label, "desc": desc})

    season = content.get("meta", {}).get("season", ["2026-09-14", "2027-06-04"])
    data = {
        "format": 1,
        "title": "Planning BPJEPS MAPST 2026-2027",
        "season": {"start": season[0], "end": season[1]},
        "source": {
            "planningDate": args.planning_date,
            "planningDateLabel": f"{'1er' if pd.day == 1 else pd.day} {months_fr[pd.month - 1]} {pd.year}",
            "sources": sources,
            "corrections": content.get("meta", {}).get("updated", ""),
            "exported": date.today().isoformat(),
        },
        "categories": categories,
        "weeks": [{"monday": m, "number": n} for m, n in sorted(weeks.items())],
        "stages": stages,
        "keyDates": key_dates,
        "breaks": [{"start": b["s"], "end": b["e"], "title": b["t"]} for b in content.get("breaks", [])],
        "schoolHolidays": [{"start": h["s"], "end": h["e"], "title": h["t"], "zone": "B"}
                           for h in content.get("schoolHolidays", [])],
        "publicHolidays": [{"date": d, "title": t} for d, t in sorted(content.get("holidays", {}).items())],
        "checks": checks,
        "days": dict(sorted(days.items())),
    }

    text_json = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    text_ics = build_ics(data, categories)

    # Safety net: search the output for anything personal.
    found = find_personal(text_json, words, phrases) + find_personal(text_ics, words, phrases)
    if found:
        fail("personal data found in the output:\n  " + "\n  ".join(sorted(set(found))))

    # Report
    slots = [s for d in days.values() for s in d.get("slots", [])]
    print(f"Days: {len(days)}   half-days: {len(slots)} ({sum(1 for s in slots if s.get('free'))} free)")
    print(f"Training weeks: {len(weeks)}   stages: {len(stages)}   key dates: {len(key_dates)}   notes: {len(checks)}")
    print("Categories:", dict(Counter(s['cat'] for s in slots)))
    print("Trainers (planning -> public):")
    for raw, shown in sorted(who_seen.items()):
        print(f"   {raw!r:32} -> {shown!r}")
    if unknown_topics:
        print("Topics without a label in content.json (shown as written):")
        for t in sorted(unknown_topics):
            print("   ", t)
    if dropped:
        print("Left out (personal):")
        for d in dropped:
            print("   ", d)
    if args.check:
        print("\n--check: nothing written.")
        return
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(text_json, encoding="utf-8")
    with open(OUT_ICS, "w", encoding="utf-8", newline="") as f:
        f.write(text_ics)
    print(f"\nWrote {OUT_JSON.relative_to(ROOT)} ({len(text_json) // 1024} KB) "
          f"and {OUT_ICS.relative_to(ROOT)} ({len(text_ics) // 1024} KB).")


if __name__ == "__main__":
    main()
