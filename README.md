# Quick Prompt

**One hotkey, any AI, any app on your Mac.**

Press **⌘⇧G** from anywhere — your inbox, your IDE, a Slack message, a Google Doc — and a sleek overlay appears. Type or paste text, hit Enter, and your prompt runs. The result is auto-copied to your clipboard, ready to paste back where you started. Total time: under two seconds.

<!-- screenshot: add screenshot.png here -->

## What you'll love

- **Pick your engine.** Anthropic, OpenAI, or a local model on your own Mac. Switch any time in Settings.
- **Free, private mode.** Run it 100% offline with Apple Intelligence (via Apfel), Ollama, or LM Studio. No API key, no cloud, no telemetry.
- **Zero context switch.** Floats over whatever you're doing. Auto-fills from clipboard. Auto-copies the result. Vanishes on Esc.
- **Your prompt, your tool.** Out of the box it polishes writing. Edit the system prompt in Settings to translate, summarize, fix code, write commit messages — anything.
- **Lives in the menu bar.** No Dock clutter, no window management.
- **Works in fullscreen.** The overlay floats above fullscreen apps and follows your cursor across multiple monitors.

Native macOS app. Apple Silicon and Intel. Free and open source.

## Get started

Three steps. Two minutes.

### 1. Install

Open the DMG and drag **Quick Prompt** into your **Applications** folder.

> **First launch:** the app is unsigned, so macOS will block it. Open **Applications**, **right-click** Quick Prompt → **Open**, then click **Open** again to confirm. You only have to do this once.

### 2. Pick a provider

Press **⌘⇧G** to open the overlay, then **⌘,** to open Settings.

Choose one of three tabs at the top:

- **Anthropic** — paste an API key from [console.anthropic.com](https://console.anthropic.com).
- **OpenAI** — paste an API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
- **Local Server** — point it at a local server on your Mac (see below). No API key needed.

Click **Test Connection** to verify, then **Save**.

### 3. Use it

Anywhere on your Mac, in any app:

1. Press **⌘⇧G** — the overlay appears.
2. Type or paste your text.
3. Press **Enter** — the result appears and is copied to your clipboard.
4. Switch to your app and press **⌘V** to paste.

## Shortcuts

| Shortcut | What it does |
|---|---|
| `⌘⇧G` | Open / close the overlay (works from any app) |
| `Enter` | Send your text — or, on a result, start a new query |
| `Esc` | Dismiss the overlay |
| `⌘,` | Open Settings (provider, model, system prompt) |

**Pro tips**

- **Copy first, summon second.** If you copy text *before* pressing ⌘⇧G, Quick Prompt auto-fills it for you.
- **Right-click the menu bar icon** for Show/Hide, Settings, and Quit.
- **Drag to resize.** The Settings window and the system prompt textarea can both be resized to fit long prompts.

## Providers

### Anthropic (cloud)

Best quality for text tasks. Requires an API key from [console.anthropic.com](https://console.anthropic.com).
Models: Claude Sonnet 4, Claude Opus 4, Claude Haiku 4.5, Claude Sonnet 4.5.
Cost: typically $0.001-0.01 per request, depending on model and text length.

### OpenAI (cloud)

Requires an API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
Models: GPT-4o, GPT-4o-mini, GPT-4.1, GPT-4.1-mini, GPT-4.1-nano, o3-mini.
Cost: varies by model.

### Local Server (free, offline, private)

Connect to any OpenAI-compatible server running on your Mac. No API key, no internet, no cost. Your text never leaves your machine.

**Apple Intelligence via Apfel** *(macOS 26+, Apple Silicon)*
1. Install: [github.com/Arthur-Ficial/apfel](https://github.com/Arthur-Ficial/apfel)
2. Run: `apfel --serve`
3. Settings → Local Server → URL `http://127.0.0.1:11434`, Model `apple-foundationmodel`

**Ollama**
1. Install: [ollama.ai](https://ollama.ai)
2. Pull a model: `ollama pull llama3`
3. Run: `ollama serve`
4. Settings → Local Server → URL `http://127.0.0.1:11434`, Model `llama3`

**LM Studio**
1. Install: [lmstudio.ai](https://lmstudio.ai)
2. Download a model, start the local server
3. Settings → Local Server → URL `http://127.0.0.1:1234`, Model (the one shown in LM Studio)

## Customize the prompt

Press **⌘,** in Settings, edit the **System Prompt** textarea (resizable — drag the bottom edge), and click **Save**.

The default polishes writing. Change it to anything you'd ask an LLM: translate, summarize, fix code, soften tone, write commit messages, generate test cases.

## Build from source

Requirements: macOS 12+, Node.js 18+, pnpm.

```bash
git clone <repo-url>
cd quick-prompt
pnpm install
pnpm run start         # dev
pnpm run make          # produce DMG (host arch) → out/make/Quick Prompt.dmg
```

To build for Intel on Apple Silicon: `pnpm exec electron-forge make --arch=x64`. Each `make` overwrites `out/make/Quick Prompt.dmg` — rename between runs if building both architectures.

## License

[GNU Affero General Public License v3.0 or later](LICENSE) (AGPL-3.0-or-later).

Copyright © 2026 yzhbankov.

In short: you're free to use, study, modify, and redistribute Quick Prompt, including over a network. **Any derivative work — including a hosted/SaaS version — must be released under the same license, with full source code available to its users.** See `LICENSE` for the full text.
