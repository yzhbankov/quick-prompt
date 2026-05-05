# PROMPT 5 — API call to Anthropic

Create an IPC handler `"check-text"` in main process that accepts a string and returns corrected text from the Claude API. Use the settings from `electron-store`.

## Implementation in main process

IPC handler `"check-text"`:

- Read `apiKey`, `systemPrompt`, and `model` from the store (import from `settings.ts`)
- If `apiKey` is empty, return `{ success: false, error: "API key not configured. Open Settings with ⌘," }`
- Create an `AbortController` with 30 second timeout via `setTimeout(() => controller.abort(), 30000)`
- Make a fetch POST to `https://api.anthropic.com/v1/messages`
- Headers: `{ "Content-Type": "application/json", "x-api-key": apiKey from store, "anthropic-version": "2023-06-01" }`
- Body: `{ model: model from store, max_tokens: 4096, system: systemPrompt from store, messages: [{ role: "user", content: the input text }] }`
- On success: extract `content[0].text` from the JSON response, return `{ success: true, text: result }`
- On `AbortError`: return `{ success: false, error: "Request timed out after 30 seconds" }`
- On any other error (network failure, non-200 status, JSON parse error): return `{ success: false, error: human-readable message including the HTTP status code if available }`
- Always clear the timeout in a `finally` block

## In `preload.ts`, expose via `contextBridge` as `window.api`

- `checkText(text: string): Promise<{ success: boolean, text?: string, error?: string }>`
- `isApiKeyMissing(): Promise<boolean>`
- `hideWindow(): void`
- `openSettings(): void`
- `copyToClipboard(text: string): void`
- `getClipboardText(): Promise<string>`
- `onFocusInput(callback: () => void): void`
- `onSettingsUpdated(callback: (settings: { model: string }) => void): void`
- `resizeWindow(height: number): void`
- `getModel(): Promise<string>`

Define a TypeScript interface for `window.api` and declare it on the `Window` type so there are no TS errors in the renderer.

## In renderer

On Enter keypress in the input:

- If input is empty, do nothing
- Disable the input, change placeholder to "Thinking..."
- Call `window.api.checkText(inputValue)`
- Log the response to console for now
- Re-enable the input after response

On renderer load: call `window.api.isApiKeyMissing()`. If true, set input placeholder to `"⚠ API key not set. Press ⌘, for Settings"` and disable the input. Also load the current model and set the model label text.

## CHECKPOINT 5

Run these checks:

- `npx tsc --noEmit` — zero TypeScript errors
- `grep -rn "process.env.ANTHROPIC" src/` — should return ZERO results (no env var usage)
- `grep -rn "dotenv" src/` — should return ZERO results
- `grep -n "x-api-key" src/main.ts` — API key header present
- `grep -n "anthropic-version" src/main.ts` — version header present
- `grep -n "AbortController" src/main.ts` — timeout handling exists
- `grep -n "contextBridge" src/preload.ts` — API exposed
- Test with a valid API key (configure via Settings first):
  - Cmd+Shift+G, type "this is a test sentense with erors", Enter
  - Input disables, shows "Thinking..."
  - Console should log response with `success: true` and corrected text
- Test with no API key:
  - `rm -f ~/Library/Application\ Support/Quick\ Prompt/config.json`
  - Restart — placeholder shows warning, input disabled
- Test with invalid API key:
  - Open settings, enter `"fake-key-12345"` as API key, save
  - Type text, Enter — console should log error with 401

Fix any issues before moving on.
