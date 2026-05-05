# PROMPT 3 — Global shortcut

Register a global shortcut using Electron's built-in `globalShortcut` module in main process.

- On app ready, after creating the window, register `"CmdOrCtrl+Shift+G"`
- If `globalShortcut.register` returns false, try fallback `"CmdOrCtrl+Shift+Space"`. If both fail, log a warning — the app still works via tray menu.
- Store whichever shortcut was registered in a variable for the tray menu label.

## On trigger

- If window is hidden: show it, center it on screen (in case display changed), send `"focus-input"` IPC event to renderer
- If window is visible: hide it

In renderer: on `"focus-input"` event, focus the input and select all text.

Unregister all shortcuts on app `"will-quit"` event.

Update tray context menu to show the active shortcut: "Show/Hide (⌘⇧G)" and "Quit"

## CHECKPOINT 3

Run these checks:

- `npx tsc --noEmit` — zero TypeScript errors
- `grep -n "globalShortcut.register" src/main.ts` — confirm the registration code exists
- `grep -n "globalShortcut.unregisterAll" src/main.ts` — confirm cleanup on quit exists
- `pnpm run start` — launch the app and verify manually:
  - Switch to a different app (Finder, Terminal, anything)
  - Press Cmd+Shift+G — overlay appears, input is focused
  - Press Cmd+Shift+G again — overlay hides
  - Press Cmd+Shift+G — overlay appears
  - Type some text in the input — confirm the input works
  - Press Escape — overlay hides
  - Press Cmd+Shift+G — overlay appears, input is focused and any previous text is selected

Fix any issues before moving on.
