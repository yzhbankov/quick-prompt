# PROMPT 1 — Electron project scaffold

Inside the `quick-prompt` directory, create an Electron app using electron-forge with the Vite + TypeScript template. Run:

```bash
pnpm dlx create-electron-app@latest . --template=vite-typescript
```

After scaffolding:

- Verify the project builds and launches with `pnpm run start`
- Strip all boilerplate content from the renderer HTML — leave only an empty page with `<body style="background: #1a1a1a; margin: 0;"></body>`
- The project structure should be: `src/main.ts` (main process), `src/preload.ts` (preload), `src/renderer/` (frontend HTML/CSS/TS)
- Install dependencies: `pnpm add electron-store`
- Verify `pnpm run start` still works — you should see an empty dark window

If the build fails, check `forge.config.ts` and make sure the Vite plugin configuration has correct entry points matching the actual file paths. Do not add any features yet.

## CHECKPOINT 1

Run these checks and print results:

- `pnpm run start` — does the app launch without errors? (start it, wait 3 seconds, then kill the process. Check stderr for errors.)
- `ls src/` — confirm `main.ts`, `preload.ts`, and `renderer/` directory exist
- `cat package.json | grep electron-store` — confirm `electron-store` is in dependencies
- `cat src/renderer/index.html` — confirm it has no boilerplate content, just the dark background body
- `npx tsc --noEmit` — confirm zero TypeScript errors

If any check fails, fix the issue and re-run all checks before moving on.
