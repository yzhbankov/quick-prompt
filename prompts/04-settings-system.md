# PROMPT 4 — Settings system

Add a Settings screen where the user can configure their Anthropic API key, the AI model, and the system prompt. These settings must persist across app restarts.

## 4.1 Settings storage (main process)

Create a settings module (`src/settings.ts`) that initializes `electron-store` with this schema:

- `apiKey`: string, default `""`
- `systemPrompt`: string, default `"You are a writing assistant. Check and correct the following text for grammar, spelling, punctuation, and clarity. Return ONLY the corrected text. No explanations, no preamble, no quotes around the text."`
- `model`: string, default `"claude-sonnet-4-20250514"`
- `availableModels`: string array, default:

```json
[
  "claude-sonnet-4-20250514",
  "claude-opus-4-20250514",
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-5-20250514"
]
```

`electron-store` saves to `~/Library/Application Support/Quick Prompt/config.json` automatically — no manual file handling needed.

The `apiKeyMissing` check: `store.get('apiKey') === ''`

## 4.2 Settings window (main process)

Add a new IPC handler `"open-settings"` that creates a SECOND `BrowserWindow`:

- `width: 500`, `height: 420`
- `frame: true` (normal window with title bar — NOT frameless)
- `title: "Quick Prompt Settings"`
- `resizable: false`
- `alwaysOnTop: true`
- `modal: false`
- Load a separate HTML file: `src/renderer/settings.html`

Only one settings window at a time — if already open, focus it instead of creating another.

Add IPC handlers:

- `"get-settings"`: returns `{ apiKey, systemPrompt, model, availableModels }` from the store
- `"save-settings"`: accepts `{ apiKey, systemPrompt, model, availableModels }`, saves to the store, returns `{ success: true }`
- `"close-settings"`: closes the settings window

## 4.3 Settings UI (renderer)

Create `src/renderer/settings.html` + `settings.ts` + `settings.css`.

The settings page should have these fields top to bottom:

### API Key

- Label "API Key"
- A password-type input (full width) with a show/hide toggle button

### Model

- Label "Model"
- A dropdown/select element populated from `availableModels`, with the current model selected
- Below the dropdown: a text input labeled "Custom model" with a small "Add" button next to it. When "Add" is clicked: validate the input is not empty and not already in the list, add it to the dropdown, select it, clear the custom input. The added model persists in `availableModels`.

### System Prompt

- Label "System Prompt" with a "Restore Default" link/button next to it
- A textarea (full width, 5 rows)
- "Restore Default" resets the textarea to the default prompt text

### Buttons

- "Save" and "Cancel" at the bottom, right-aligned
- Save: validates API key is not empty and a model is selected, saves all values via IPC, shows "Saved ✓", closes after 500ms
- Cancel: closes without saving

### Style

Dark theme — background `#1a1a1a`, white text, borders `rgba(255,255,255,0.1)`, inputs background `#2a2a2a`, white text, `8px` border-radius, `8px` padding, `12px` spacing between fields.

## 4.4 Preload for settings

- Create `src/preload-settings.ts`
- Expose via `contextBridge`: `window.settingsApi.getSettings()`, `window.settingsApi.saveSettings(data)`, `window.settingsApi.closeSettings()`
- Define TypeScript interfaces for the settings data

## 4.5 Entry points to Settings

- Tray menu "Settings..." item opens the settings window
- In the overlay, when `apiKeyMissing` is true: placeholder says `"⚠ API key not set. Press ⌘, for Settings"`
- Cmd+Comma in the overlay renderer opens settings (standard macOS convention — not a global shortcut, only when overlay is focused)

## 4.6 Live update after saving

- When `"save-settings"` is handled in main, send `"settings-updated"` event to the overlay window with the new settings
- In the overlay renderer, on `"settings-updated"`: re-check `apiKeyMissing`, update placeholder, enable/disable input, update the model label

## 4.7 Model label in overlay

Add a small label in the top-right corner of the overlay container showing the current model in muted text (font-size `10px`, color `rgba(255,255,255,0.2)`).

Format for display by stripping the date suffix:

- `"claude-sonnet-4-20250514"` → `"sonnet 4"`
- `"claude-opus-4-20250514"` → `"opus 4"`
- `"claude-haiku-4-5-20251001"` → `"haiku 4.5"`
- `"claude-sonnet-4-5-20250514"` → `"sonnet 4.5"`
- Unknown patterns: show as-is

## CHECKPOINT 4

Run ALL of the following:

### A. Code structure

- `npx tsc --noEmit` — zero TypeScript errors
- `ls src/renderer/settings.html` — settings page exists
- `ls src/preload-settings.ts` — settings preload exists
- `grep -n "open-settings" src/main.ts` — handler exists
- `grep -n "save-settings" src/main.ts` — handler exists
- `grep -n "get-settings" src/main.ts` — handler exists
- `grep -n "settings-updated" src/main.ts` — live update exists
- `grep -n "model" src/settings.ts` — model field in schema
- `grep -n "availableModels" src/settings.ts` — `availableModels` field in schema

### B. First launch (no config)

- `rm -f ~/Library/Application\ Support/Quick\ Prompt/config.json`
- `pnpm run start`
- Cmd+Shift+G — overlay shows, input disabled, placeholder mentions API key
- Model label shows "sonnet 4" (default)
- Cmd+Comma — settings window opens
- Settings shows: empty API key, `"claude-sonnet-4-20250514"` selected, default prompt, all 4 models in dropdown
- Click Save with empty API key — validation error, does NOT close
- Cancel — closes settings

### C. Configure and use

- Open settings via tray > "Settings..."
- Enter a valid API key, leave defaults
- Save — "Saved ✓", window closes
- Overlay input immediately enabled (no restart)
- Model label shows "sonnet 4"
- Type "this are wrong grammer" → Enter → corrected result

### D. Model switching

- Open settings, change model to `"claude-haiku-4-5-20251001"`, save
- Overlay model label now shows "haiku 4.5"
- Type text → Enter → get result (confirms model string sent correctly)
- Open settings — `"claude-haiku-4-5-20251001"` still selected

### E. Custom model

- Open settings
- Type `"my-custom-model-v1"` in custom model input, click Add
- Dropdown now has 5 items, `"my-custom-model-v1"` selected
- Save
- Overlay model label shows `"my-custom-model-v1"` (no pattern match, shown as-is)
- Quit and restart
- Open settings — `"my-custom-model-v1"` still in dropdown and selected

### F. Edge cases

- Open settings twice — should focus existing, not open second
- Toggle API key show/hide — switches between masked and plain text
- Try adding empty custom model — should not add
- Try adding duplicate model — should not create duplicate
- Long system prompt (500+ chars) — should scroll, save works

Fix any issues before moving on.
