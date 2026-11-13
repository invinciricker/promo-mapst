#!/usr/bin/env bash
# ---------------------------------------------------------------------------------------
# Downloads the three Firebase files of the app into vendor/firebase/ (Phase 6).
# Run it once; the result is committed. Run it again only to change VERSION.
#
# The accounts, the classement and the questions use Firebase (Google), free plan. The
# app needs three of its browser files, from the npm package "firebase" (Apache 2.0):
#   firebase-app.js             the base
#   firebase-auth.js            signing in (pseudo + 6-digit code)
#   firebase-firestore-lite.js  the database, "Lite": plain reads and writes, no live
#                               listeners, much smaller than the full one
# No Analytics, no other product.
#
# Why a copy in vendor/? The app must not load anything from another website at runtime.
# The two last files import the first one from Google's website (www.gstatic.com): this
# script rewrites that line so they import ./firebase-app.js, the copy next to them.
# It also removes the last line of each file (a link to a ".map" file for developers,
# which is not copied).
#
# Usage (from the folder of the repository):
#     bash scripts/fetch_firebase.sh
# Needs: curl, tar and sed (already on Mac and Linux; on Windows use Git Bash).
# ---------------------------------------------------------------------------------------
set -euo pipefail

VERSION="13.1.0"
URL="https://registry.npmjs.org/firebase/-/firebase-${VERSION}.tgz"
FILES="firebase-app.js firebase-auth.js firebase-firestore-lite.js"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/vendor/firebase"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading $URL"
curl -fsSL "$URL" -o "$TMP/firebase.tgz"
tar -xzf "$TMP/firebase.tgz" -C "$TMP"

mkdir -p "$DEST"
for f in $FILES; do
  # 1. import ... from "https://www.gstatic.com/firebasejs/<version>/firebase-app.js"
  #    becomes  import ... from "./firebase-app.js"
  # 2. the line "//# sourceMappingURL=..." is removed
  sed -e "s#\"https://www.gstatic.com/firebasejs/${VERSION}/firebase-app.js\"#\"./firebase-app.js\"#g" \
      -e "s#'https://www.gstatic.com/firebasejs/${VERSION}/firebase-app.js'#'./firebase-app.js'#g" \
      -e '/^\/\/# sourceMappingURL=/d' \
      "$TMP/package/$f" > "$DEST/$f"
done
cp "$TMP/package/LICENSE" "$DEST/LICENSE-firebase.txt" 2>/dev/null || \
  curl -fsSL "https://raw.githubusercontent.com/firebase/firebase-js-sdk/firebase@${VERSION}/LICENSE" -o "$DEST/LICENSE-firebase.txt"
echo "$VERSION" > "$DEST/VERSION"

# Safety: nothing may still import from Google's website.
if grep -l "from *[\"']https://" "$DEST"/*.js; then
  echo "A file above still imports from another website: fix this script." >&2
  exit 1
fi
echo "Done: vendor/firebase/ ($FILES), version $VERSION."
