# Quick Prompt — native Swift port

A native macOS (AppKit) rewrite of the Electron app. Same behavior, **~376 KB** instead of ~264 MB.

## Build & run

```bash
cd swift
swift run            # build + launch (dev)
./build-app.sh       # produce "Quick Prompt.app" (release, ad-hoc signed)
open "Quick Prompt.app"
```

Requirements: macOS 13+, Xcode command-line tools (Swift 5.9+).

## What it does (parity with the Electron version)

- **Menu-bar app** (`LSUIElement`) with a status-bar icon and menu: Show/Hide, Settings…, Show in Dock (toggle), Quit.
- **Global hotkey ⌘⇧G** toggles the overlay (via Carbon `RegisterEventHotKey` — no Accessibility permission needed).
- **Spotlight-style overlay** (`NSPanel`, floats over full-screen Spaces): type/paste text → ↵ sends it to the configured provider → corrected text is shown and auto-copied to the clipboard. ↵ again starts over, `esc` dismisses. Pre-fills from the clipboard and grows to fit the result (100–500 px).
- **Providers:** Anthropic (`/v1/messages`), OpenAI (`/v1/chat/completions`), and any OpenAI-compatible local server. 30 s timeout.
- **Settings window:** provider tabs, API key (with show/hide), free-text model field, system prompt (+ restore default), and per-provider **Test Connection** (model-aware: a bad/retired model is reported).
- **Persistence:** non-secret settings in `UserDefaults`; **API keys in the macOS Keychain** (more secure than the Electron `config.json`).

## Source map

| File | Responsibility |
|---|---|
| `main.swift` | `NSApplication` entry point |
| `AppDelegate.swift` | status-bar menu, dock toggle, hotkey wiring |
| `GlobalHotKey.swift` | Carbon system-wide hotkey |
| `OverlayController.swift` | the overlay panel + input/loading/result state machine |
| `SettingsWindowController.swift` | settings UI + Test Connection |
| `Providers.swift` | Anthropic / OpenAI / local HTTP calls + tests |
| `Settings.swift` | settings model + `UserDefaults` |
| `Keychain.swift` | API-key storage |

## Differences from the Electron version

- **macOS only** (SwiftUI/AppKit don't port to Windows/Linux).
- Menu-bar icon is an SF Symbol (`wand.and.stars`) — no bundled PNG. Swap in `AppDelegate.buildStatusItem()` if you want the original art.
- No in-app "Uninstall…" item (drag the `.app` to the Trash; settings live in `UserDefaults`/Keychain).

## Distribution

`build-app.sh` ad-hoc signs the app so it runs locally. To share it, sign with a Developer ID certificate and notarize:

```bash
codesign --force --deep --options runtime --sign "Developer ID Application: <you>" "Quick Prompt.app"
xcrun notarytool submit ... && xcrun stapler staple "Quick Prompt.app"
```
