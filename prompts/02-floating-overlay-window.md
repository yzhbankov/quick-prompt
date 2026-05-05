# PROMPT 2 — Floating overlay window

Modify the Electron `BrowserWindow` in `src/main.ts` to behave as a floating overlay like Spotlight:

## BrowserWindow options

- `width: 620`, `height: 100`
- `frame: false`
- `alwaysOnTop: true`
- `skipTaskbar: true`
- `resizable: false`
- `transparent: true`
- `backgroundColor: "#00000000"`
- `show: false` (start hidden)
- `center: true`
- `webPreferences`: preload script, `contextIsolation: true`, `nodeIntegration: false`

## On app ready

- Hide the dock icon: `app.dock.hide()`
- Create a `Tray`. For the tray icon, create a file `assets/trayIconTemplate.png` — generate it at build time as a 16x16 white circle on transparent background using a simple Node script that writes raw PNG bytes (use no external image libraries — just write a minimal valid PNG buffer). Name it with "Template" suffix so macOS auto-handles dark/light menu bar.
- Tray context menu: "Show/Hide (⌘⇧G)", "Settings...", and "Quit"

## In the renderer (`src/renderer/index.html` + `index.ts` + `styles.css`)

- A single container div with background `rgba(26, 26, 26, 0.95)`, border-radius `12px`, padding `16px`, box-shadow `0 8px 32px rgba(0,0,0,0.5)`
- Inside it: one `input` element — full width, font-size `18px`, no border, no outline, background transparent, color white, placeholder "Type or paste text..."
- Input is auto-focused on load

## Window hiding

This app uses ONLY Escape to close. Do NOT hide on blur. Do NOT hide when clicking outside. The window stays visible until the user explicitly presses Escape or toggles with the hotkey. This is intentional — the user may click other apps to copy text and come back.

## IPC

Expose a `"hide-window"` channel. In renderer, pressing Escape calls it. In main, the handler hides the window.

## CHECKPOINT 2

Run these checks:

- `ls assets/` — confirm `trayIconTemplate.png` exists and is a valid PNG (file size should be > 0 bytes, print the size)
- `npx tsc --noEmit` — zero TypeScript errors
- `pnpm run start` — launch the app and verify manually:
  - No dock icon appears
  - Tray icon appears in menu bar
  - Tray menu has three items: "Show/Hide (⌘⇧G)", "Settings...", "Quit"
  - Clicking tray "Show/Hide" shows a dark rounded overlay centered on screen
  - The overlay has a text input with placeholder "Type or paste text..."
  - Pressing Escape hides the overlay
  - Clicking outside the overlay does NOT hide it
  - Clicking tray "Quit" exits the app

If the tray icon fails to load, check the PNG file. If it's invalid, replace with a hardcoded base64 PNG loaded via `nativeImage.createFromBuffer`.

Fix any issues before moving on.
