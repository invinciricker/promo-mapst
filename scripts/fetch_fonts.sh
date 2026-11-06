#!/usr/bin/env bash
# ---------------------------------------------------------------------------------------
# Downloads the font of the app into vendor/fonts/ (run it once; the result is committed).
#
# The app uses one font, "Plus Jakarta Sans" (free, SIL Open Font License), in its
# "variable" version: a single small file (about 27 KB) that contains every weight,
# from thin to extra bold. It comes from Fontsource, which repackages Google Fonts.
#
# Why a copy in vendor/ instead of Google Fonts? The app must work offline and must not
# load anything from another website at runtime (no tracking).
#
# Usage (from the folder of the repository):
#     bash scripts/fetch_fonts.sh
# Needs: curl and tar (already on Mac and Linux; on Windows use Git Bash).
# ---------------------------------------------------------------------------------------
set -euo pipefail

VERSION="5.3.0"
PACKAGE="plus-jakarta-sans"
URL="https://registry.npmjs.org/@fontsource-variable/${PACKAGE}/-/${PACKAGE}-${VERSION}.tgz"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/vendor/fonts"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading $URL"
curl -fsSL "$URL" -o "$TMP/font.tgz"
tar -xzf "$TMP/font.tgz" -C "$TMP"

mkdir -p "$DEST"
# Only the "latin" part is needed: it covers French (é, è, à, ç, œ, « », ’ ...).
cp "$TMP/package/files/${PACKAGE}-latin-wght-normal.woff2" "$DEST/plus-jakarta-sans.woff2"
cp "$TMP/package/LICENSE" "$DEST/LICENSE-plus-jakarta-sans.txt"

echo "Done: vendor/fonts/plus-jakarta-sans.woff2 and its licence."
