import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// Every language but English ships as dist/locales/<code>.json, next to the script, and the panel
// fetches the one it needs the first time it is used (src/i18n/index.ts, createLocaleLoader).
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(packageRoot, 'locales');
const outDir = join(packageRoot, 'dist', 'locales');

if (!existsSync(from)) {
  process.stderr.write(`[copy-locales] missing ${from}\n`);
  process.exit(1);
}
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const files = readdirSync(from).filter((file) => file.endsWith('.json'));
for (const file of files) copyFileSync(join(from, file), join(outDir, file));
process.stdout.write(`[copy-locales] copied ${files.length} languages to ${outDir}\n`);
