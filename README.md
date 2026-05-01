# Quick Prompt

**The fastest way to put Claude in any app on your Mac.**

Press **⌘⇧G** from anywhere — your inbox, your IDE, a Slack message, a Google Doc — and a sleek overlay appears over your work. Type or paste text, hit Enter, and Claude rewrites it. The result is auto-copied to your clipboard, ready to paste back where you started. Total time: under two seconds.

<!-- screenshot: add screenshot.png here -->

## Why you'll love it

- **Zero context switch.** No tabs, no apps to alt-tab to, no copy-paste shuffle. Quick Prompt floats over whatever you're doing and gets out of the way the moment it's done.
- **Smart by default.** Just copied some text? Quick Prompt auto-fills it. Done with the response? It's already on your clipboard. The workflow you'd build by hand — built in.
- **Your prompt, your tool.** Out of the box it polishes writing. Change the system prompt in Settings to make it translate, summarize, soften your tone, fix code, generate commit messages, or anything else you'd ask Claude. One hotkey, infinite uses.
- **Choose your Claude.** Switch between Opus, Sonnet, and Haiku models in Settings — pay for power when you need it, save tokens when you don't.
- **Lives in your menu bar.** No Dock clutter. No window management. Quietly waits until you summon it.
- **Your key, your data.** Bring your own Anthropic API key. Requests go straight from your Mac to Anthropic — nothing in the middle, no subscriptions, no telemetry.

## Built for people who type for a living

Writers, developers, support reps, PMs, students, non-native English speakers — anyone who edits, polishes, or transforms text dozens of times a day. Quick Prompt turns "open ChatGPT, paste, prompt, copy, switch back, paste" into a single keystroke.

Native macOS app. Apple Silicon and Intel. Free and open source.

Press ⌘⇧G. Get back to work.

## Getting started

Three steps. Two minutes.

### 1. Install

Open the DMG and drag **Quick Prompt** into your **Applications** folder.

> **First launch:** the app is unsigned, so macOS will block it. Open **Applications**, **right-click** Quick Prompt → **Open**, then click **Open** again to confirm. You only have to do this once.

### 2. Add your Anthropic API key

Get a key at [console.anthropic.com](https://console.anthropic.com) (you'll need an account with billing enabled).

Then in Quick Prompt:

1. Press **⌘⇧G** to open the overlay.
2. Press **⌘,** to open Settings.
3. Paste your API key into the **API Key** field and click **Save**.

You're ready.

### 3. Use it

Anywhere on your Mac, in any app:

1. Press **⌘⇧G** — the overlay appears.
2. Type or paste your text.
3. Press **Enter** — Claude rewrites it and copies the result to your clipboard.
4. Switch back to your app and press **⌘V** to paste.

**Handy shortcuts:**

| Shortcut | What it does |
|---|---|
| `⌘⇧G` | Open / close the overlay (works from any app) |
| `Enter` | Send your text · or, on a result, start a new query |
| `Esc` | Dismiss the overlay |
| `⌘,` | Open Settings (change prompt, model, API key) |

**Pro tips:**

- **Copy first, summon second.** If you copy text *before* pressing ⌘⇧G, Quick Prompt auto-fills it for you — one less keystroke.
- **Lives in the menu bar.** No Dock icon. Click the Quick Prompt icon in your menu bar for Show/Hide/Quit.
- **Make it yours.** In Settings, edit the **System Prompt** to change what Quick Prompt does — translate, summarize, fix code, soften tone, write commit messages, anything. Switch models (Opus/Sonnet/Haiku) depending on the task.

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

To produce a distributable DMG instead:

```bash
pnpm run make
```

Output: `out/make/Quick Prompt.dmg`. By default this builds for the host architecture (arm64 on Apple Silicon, x64 on Intel).

### Building for Intel (x64) on Apple Silicon

```bash
pnpm exec electron-forge make --arch=x64
```

The DMG written to `out/make/Quick Prompt.dmg` will be Intel-only — move or rename it before running another `make`, otherwise the next build overwrites it.

To build both architectures, run once per arch and rename the DMGs between runs:

```bash
pnpm run make
mv "out/make/Quick Prompt.dmg" "out/make/Quick Prompt-arm64.dmg"
pnpm exec electron-forge make --arch=x64
mv "out/make/Quick Prompt.dmg" "out/make/Quick Prompt-x64.dmg"
```

Note: `pnpm run make -- --arch=x64` does not forward the flag in pnpm 10 — invoke `electron-forge` directly via `pnpm exec`.

For the packaged app, provide your API key in one of two ways:

**Option A — env file:**
Create `~/Library/Application Support/Quick Prompt/.env`
with `ANTHROPIC_API_KEY=your-key-here`

**Option B — system environment variable:**

```bash
export ANTHROPIC_API_KEY=your-key-here
```

## Customizing the prompt

The simplest way is to open the app and press **⌘,** for Settings — edit the **System Prompt** field and click Save.

The default starts with text correction. Change it to anything: translation, summarization, tone adjustment, code review, commit-message generation, etc.

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
