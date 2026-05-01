# Quick Prompt

A lightweight macOS overlay for instant AI text correction. Press Cmd+Shift+G from anywhere, paste text, get it corrected.

<!-- screenshot: add screenshot.png here -->

## Prerequisites

- macOS 12+
- Node.js 18+ and pnpm (for building from source)
- Anthropic API key (get one at https://console.anthropic.com)

## Setup

```bash
git clone <repo-url>
cd quick-prompt
pnpm install
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

## Run (development)

```bash
pnpm run start
```

## Build

```bash
pnpm run package
```

The app will be in `out/Quick Prompt-darwin-*/Quick Prompt.app`
Right-click > Open on first launch (app is unsigned).

For the packaged app, provide your API key in one of two ways:

**Option A — env file:**
Create `~/Library/Application Support/Quick Prompt/.env`
with `ANTHROPIC_API_KEY=your-key-here`

**Option B — system environment variable:**

```bash
export ANTHROPIC_API_KEY=your-key-here
```

## Usage

- **Cmd+Shift+G** — open/close the overlay (works from any app)
- Type or paste text, press Enter — text is corrected and auto-copied to clipboard
- **Enter** (when result is showing) — clear and start new query
- **Escape** — hide the overlay
- If you copy text before opening, it auto-pastes into the input

The app runs in the menu bar with a tray icon (no dock icon). Tray menu provides Show/Hide as a fallback.

## Customizing the prompt

Edit the system prompt in `src/main.ts` — search for `system:` in the fetch call body. Change it to anything: translation, summarization, tone adjustment, etc.

## App icon

A starter SVG icon is at `assets/icon.svg`. To produce an `.icns` for the DMG/app bundle, render it to PNG (e.g. via `rsvg-convert` or any vector editor) as `icon.png`, then on macOS:

```bash
mkdir icon.iconset
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o assets/icon.icns
```

Then add `icon: './assets/icon.icns'` back into the `maker-dmg` config (and `packagerConfig`) in `forge.config.ts` and rebuild.

## License

MIT
