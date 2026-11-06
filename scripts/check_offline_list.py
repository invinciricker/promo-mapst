#!/usr/bin/env python3
"""
Checks that every file of the app is listed in sw.js, so that it also works offline.

Run it after adding or renaming a file in css/, js/, content/, icons/ or vendor/:
    python3 scripts/check_offline_list.py

It prints the files missing from sw.js (add them to APP_FILES or CONTENT_FILES) and the
files listed in sw.js that do not exist (remove them: a wrong name breaks the offline mode).
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sw = (ROOT / "sw.js").read_text(encoding="utf-8")
listed = set(re.findall(r'^\s*"([^"]+)",?\s*$', sw, re.M))

# Files the app needs offline (the big icons are only used by the phone when installing).
needed = {"index.html", "manifest.webmanifest"}
for folder, pattern in (("css", "*.css"), ("js", "**/*.js"), ("content", "**/*"), ("vendor", "**/*.woff2")):
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
    sys.exit(1)
print(f"OK: the {len(listed)} files listed in sw.js exist, and every app file is listed.")
