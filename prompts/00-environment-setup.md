# PROMPT 0 — Environment setup

Verify the following are installed and working: Node.js >= 18, pnpm, git. If any are missing, stop and list what's needed.

Create a new directory "quick-prompt". Inside it:

- Initialize git
- Create `.gitignore` with: `node_modules`, `dist`, `out`, `.env`, `.DS_Store`
- Create `.env.example` containing: `ANTHROPIC_API_KEY=your-api-key-here`

Do not proceed until all tools are confirmed working. Print Node.js version and pnpm version to confirm.

## CHECKPOINT 0

Print the output of `node --version`, `pnpm --version`, `git --version`. List the contents of the `quick-prompt` directory. Confirm these files exist: `.gitignore`, `.env.example`. If anything is wrong, fix it before moving on.
