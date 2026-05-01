// Builds native node-gyp modules required by @electron-forge/maker-dmg.
// pnpm v10 skips auto-compilation for transitive deps that lack explicit
// install scripts (macos-alias, fs-xattr); this script runs the build for
// them on macOS only. Idempotent: skips packages that are already built.
const { existsSync } = require('node:fs');
const { execSync } = require('node:child_process');
const path = require('node:path');

if (process.platform !== 'darwin') {
  process.exit(0);
}

const packages = ['macos-alias', 'fs-xattr'];
for (const name of packages) {
  const cwd = path.join(__dirname, '..', 'node_modules', name);
  if (!existsSync(cwd)) continue;
  if (existsSync(path.join(cwd, 'build', 'Release'))) continue;
  try {
    console.log(`[build-dmg-natives] Building ${name}...`);
    execSync('npx node-gyp rebuild', { cwd, stdio: 'inherit' });
  } catch (err) {
    console.warn(
      `[build-dmg-natives] Failed to build ${name}: ${err.message}. ` +
        `DMG creation will not work until this is resolved.`,
    );
  }
}
