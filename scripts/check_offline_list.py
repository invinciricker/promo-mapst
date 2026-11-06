#!/usr/bin/env python3
"""
Checks that every file of the app is listed in sw.js, so that it also works offline.

Run it after adding or renaming a file in css/, js/, icons/ or vendor/:
    python3 scripts/check_offline_list.py

It prints the files missing from sw.js (add them to APP_FILES) and the files listed in
sw.js that do not exist (remove them: a wrong name breaks the offline mode).

The content (content/...) does not need to be listed: sw.js saves each content file the
first time it is fetched. So adding questions, themes or study pages never requires a
change to sw.js. The few content files listed in CONTENT_FILES (saved at installation)
must exist, though.
GitHub runs this script on every pull request (.github/workflows/checks.yml).
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sw = (ROOT / "sw.js").read_text(encoding="utf-8")
listed = set(re.findall(r'^\s*"([^"]+)",?\s*$', sw, re.M))

# Files the app needs offline (the big icons are only used by the phone when installing).
needed = {"index.html", "manifest.webmanifest"}
for folder, pattern in (("css", "*.css"), ("js", "**/*.js"), ("vendor", "**/*.woff2")):
    for f in (ROOT / folder).glob(pattern):
        if f.is_file():
            needed.add(f.relative_to(ROOT).as_posix())

missing = sorted(needed - listed)
broken = sorted(p for p in listed if not (ROOT / p).is_file())
for p in missing:
    print("missing from sw.js:", p)
for p in broken:
    print("listed in sw.js but not found:", p)
if missing or broken:
    print("\nFix: open sw.js and add the missing files to APP_FILES (or remove the names that are wrong).")
    sys.exit(1)
print(f"OK: the {len(listed)} files listed in sw.js exist, and every app file is listed.")
