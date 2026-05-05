# PROMPT 7 — Final polish

Apply these final improvements:

1. **Auto-paste from clipboard**: when the window is shown (on `"focus-input"` event in renderer), check if input is empty AND `uiState` is `"input"`. If so, call `window.api.getClipboardText()`. If the clipboard contains text (non-empty, not just whitespace), paste it into the input and select all. This way the user can copy text in any app, press the hotkey, and just press Enter.

2. **Window show animation**: in main process, before showing window, set window opacity to `0` using `mainWindow.setOpacity(0)`, then show it, then animate opacity to `1` over 150ms using a `setInterval` that increments by `0.1` every `15ms` and clears itself at `1.0`. Wrap this in a try-catch — if `setOpacity` throws or behaves badly, just show the window directly without animation.

3. **Review all source files**:
   - Remove any `console.log` statements except for error logging
   - Remove unused imports
   - Verify all TypeScript types are correct — no `any` types, no TS errors
   - Consistent formatting: 2-space indent, semicolons, single quotes for strings
   - Each file should have a one-line comment at the top explaining what it does

## CHECKPOINT 7

- `npx tsc --noEmit` — zero TypeScript errors
- `grep -rn "console.log" src/` — should return zero results (only `console.error` or `console.warn` acceptable)
- `grep -rn ": any" src/` — should return zero results
- `grep -rn "dotenv" src/` — should return zero results
- `grep -rn "process.env.ANTHROPIC" src/` — should return zero results

### Test A — auto-paste

- Copy text in another app → Cmd+Shift+G → text appears in input, selected
- Press Enter → corrected result

### Test B — auto-paste only when empty

- Cmd+Shift+G → clear input → type custom text → Escape (window resets)
- Copy different text → Cmd+Shift+G → should show new clipboard text (because window reset clears input)

### Test C — animation

- Cmd+Shift+G → window should fade in (not flash)

### Test D — full end-to-end

- Copy text → Cmd+Shift+G → Enter → result → copied → Enter → new query → type manually → Enter → result → Escape

### Test E — settings round-trip

- Open settings → change model → save → overlay model label updates
- Open settings → change prompt to "Translate to French" → save
- Type "Hello" → Enter → French result
- Open settings → Restore Default → save
- Type "Hello" → Enter → grammar-checked result (not French)

Fix any issues before moving on.
