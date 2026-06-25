#!/usr/bin/env bash
# Build "Quick Prompt.dmg" — a drag-to-Applications installer for this Mac.
set -euo pipefail
cd "$(dirname "$0")"

APP="Quick Prompt.app"
VOL="Quick Prompt"
DMG="Quick Prompt.dmg"

# 1. Build the (release, ad-hoc signed) .app
./build-app.sh

# 2. Stage a folder containing the app + an /Applications drop target
STAGE="$(mktemp -d)"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"

# 3. Create a compressed, read-only DMG
rm -f "$DMG"
hdiutil create \
  -volname "$VOL" \
  -srcfolder "$STAGE" \
  -fs HFS+ \
  -format UDZO \
  -ov "$DMG" >/dev/null

rm -rf "$STAGE"
echo "✔ Built $(pwd)/$DMG"
du -sh "$DMG"
