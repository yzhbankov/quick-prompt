#!/usr/bin/env bash
# Build Quick Prompt.app (release) from the Swift package.
set -euo pipefail

cd "$(dirname "$0")"

APP_NAME="Quick Prompt"
BIN_NAME="QuickPrompt"
BUILD_DIR=".build/release"
APP="${APP_NAME}.app"

echo "▸ Building release binary…"
swift build -c release

echo "▸ Assembling ${APP}…"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BUILD_DIR/$BIN_NAME" "$APP/Contents/MacOS/$BIN_NAME"
cp Resources/Info.plist "$APP/Contents/Info.plist"

# Ad-hoc code signature so macOS will run it locally (Keychain access needs a stable identity).
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || \
  echo "  (codesign skipped — app still runs; you may get a Gatekeeper prompt)"

echo "✔ Built $(pwd)/$APP"
du -sh "$APP"
