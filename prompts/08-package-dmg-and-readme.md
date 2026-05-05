# PROMPT 8 — Package, DMG, and README

Install the DMG maker: `pnpm add -D @electron-forge/maker-dmg`

In `forge.config.ts`, add the DMG maker to the makers array:

```ts
{
  name: '@electron-forge/maker-dmg',
  config: {
    name: 'Quick Prompt',
    format: 'ULFO'
  }
}
```

Keep the existing `maker-zip` as well.

App name: "Quick Prompt". Bundle identifier: `com.quickprompt.app`. Set these in `forge.config.ts` `packagerConfig`.

Run `pnpm run make` — this should produce both a `.zip` and a `.dmg` in `out/make/`.

## Write `README.md`

````markdown
# Quick Prompt

A lightweight macOS overlay for instant AI text correction. Press Cmd+Shift+G from anywhere, paste text, get it corrected.

<!-- screenshot: add screenshot.png here -->

## Prerequisites

- macOS 12+
- Node.js 18+ and pnpm (for building from source)
- Anthropic API key (get one at https://console.anthropic.com)

## Setup

git clone <repo-url>
cd quick-prompt
pnpm install

## Run (development)

pnpm run start

On first launch, open Settings (tray icon > Settings, or ⌘, in the overlay) and enter your Anthropic API key.

## Build

pnpm run make

Outputs:
- DMG installer: out/make/*.dmg
- ZIP archive: out/make/zip/*/*.zip

The app is unsigned. Right-click > Open on first launch, or run:
xattr -cr /Applications/Quick\ Prompt.app

## Usage

- Cmd+Shift+G — open/close the overlay (works from any app)
- Type or paste text, press Enter — text is corrected and auto-copied to clipboard
- Enter (when result is showing) — clear and start new query
- Escape — hide the overlay
- ⌘, — open Settings
- If you copy text before opening, it auto-pastes into the input

The app runs in the menu bar with a tray icon (no dock icon).

## Settings

Open via tray icon > Settings or ⌘, in the overlay.

- **API Key** — your Anthropic API key
- **Model** — select from defaults or add a custom model string
- **System Prompt** — the instruction sent to the AI (default: grammar correction)

Settings are saved to ~/Library/Application Support/Quick Prompt/config.json

## Customization examples

Change the system prompt in Settings to:
- "Translate the following text to French. Return ONLY the translation."
- "Summarize the following text in 2-3 sentences."
- "Rewrite the following text in a professional business tone."

## License

MIT
````

Do a final clean build.

## CHECKPOINT 8

- `rm -rf out node_modules`
- `pnpm install` — no errors
- `npx tsc --noEmit` — zero TypeScript errors
- `pnpm run start` — works in dev (quick test: Cmd+Shift+G, configure API key in settings, type text, Enter, result, Escape)
- `pnpm run make` — completes without errors
- `find out/make -name "*.dmg"` — DMG exists, print path and size
- `find out/make -name "*.zip"` — ZIP exists, print path and size
- Open the DMG: `open <path-to-dmg>`
  - DMG mounts, shows the `.app`
  - Drag `.app` to Applications (or run from DMG)
  - Right-click > Open (first launch bypass)
  - Cmd+Shift+G — overlay appears
  - Open settings (⌘,), enter API key, select model, save
  - Type text → Enter → corrected result → copied to clipboard
  - Escape to dismiss
  - Quit via tray > Quit
  - Relaunch from Applications — settings persisted, works immediately
- `cat README.md` — exists with all sections
- `cat .gitignore` — confirms `out/` is ignored

If ANY check fails, fix and re-run ALL checks.

If all 10 checks pass, the project is complete.
