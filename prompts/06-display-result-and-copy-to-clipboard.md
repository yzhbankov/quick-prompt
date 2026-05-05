# PROMPT 6 — Display result and copy to clipboard

After the API call returns, display the result in the overlay and copy it to clipboard.

## UI changes to the renderer

- Below the input, add a hidden result container div: background `rgba(255,255,255,0.05)`, border-radius `8px`, padding `12px`, margin-top `12px`, font-family `"SF Mono", "Menlo", monospace`, font-size `15px`, color `#e0e0e0`, white-space `pre-wrap`, overflow-y `auto`, max-height `300px`, user-select `text`.
- Below the result container, add a hidden status label: font-size `12px`, color `rgba(255,255,255,0.4)`
- Below the input (always visible), add a hint label: `"↵ Check · esc Dismiss · ⌘, Settings"` in font-size `11px`, color `rgba(255,255,255,0.25)`, margin-top `8px`

## State machine

The UI has three states managed by a variable `uiState`:

### STATE "input" (default)

- Only input + hint label + model label visible
- Result container and status label hidden
- Window size: `620 x 100`
- Enter with non-empty input: start API call, transition to "loading"
- Enter with empty input: do nothing
- Escape: call `window.api.hideWindow()`
- Cmd+Comma: call `window.api.openSettings()`

### STATE "loading"

- Input disabled, shows "Thinking..." as placeholder, original text stored in a variable
- Hint label changes to: "Waiting for response..."
- Window size: same as input state
- Escape: does nothing (prevent closing during API call)
- When API returns success: transition to "result"
- When API returns error: transition to "result" but show error styling

### STATE "result"

- Input visible showing original text (disabled, dimmed color)
- Result container visible with the corrected text
  - If error: text color `#ff6b6b`, no clipboard copy
  - If success: normal styling, auto-copy to clipboard via `window.api.copyToClipboard(text)`
- Status label visible:
  - If success: `"✓ Copied to clipboard"` — after 2 seconds, change text to `""` using `setTimeout`
  - If error: show nothing
- Hint label changes to: `"↵ New · esc Dismiss"`
- Window size: `620 x calculated height`. Measure the outer wrapper div's `scrollHeight + 40px padding`, cap at `500px`, minimum `100px`. Call `window.api.resizeWindow(height)`. In main process, handle this IPC by calling `mainWindow.setSize(620, height)` then `mainWindow.center()`
- Enter: clear input value, clear result, hide result container, transition back to "input" state, resize window to `100`
- Escape: call `window.api.hideWindow()` — hide the window entirely, AND reset state to "input" (clear input and result so next open is fresh)

In main process, when hiding the window (from IPC `"hide-window"`), also reset window size to `620x100` so it's correct next time it shows.

## CHECKPOINT 6

Run these checks:

- `npx tsc --noEmit` — zero TypeScript errors
- Test with a valid API key (configure via Settings):

### Test A — happy path

- Cmd+Shift+G → type "this are wrong grammer and speling" → Enter
- Input disables, "Thinking..." shown
- Result appears below input, window expands
- "✓ Copied to clipboard" appears briefly
- Open TextEdit, Cmd+V — corrected text pasted
- Press Enter — result clears, back to empty input, window shrinks
- Press Escape — window hides

### Test B — error path

- Set a fake API key in settings, save
- Cmd+Shift+G → type text → Enter
- Error message in red
- Press Escape — window hides

### Test C — state transitions

- Show overlay, type text, Enter (loading)
- Press Escape during loading — nothing happens
- Wait for result
- Press Escape — window hides AND resets
- Cmd+Shift+G — clean empty input, not previous result

### Test D — window resize

- Submit long text producing multi-line result
- Window expands but does not exceed 500px
- Enter to clear — window shrinks back

### Test E — settings shortcut

- In overlay, press Cmd+Comma — settings window opens

Fix any issues before moving on.
