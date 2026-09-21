import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// The third-party notices travel with the bundle: every copy of pulxon.min.js has to be able to
// point at them, and the site serves them from the same folder as the script.
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(packageRoot, 'THIRD_PARTY_NOTICES.txt');
const outDir = join(packageRoot, 'dist');

if (!existsSync(from)) {
  process.stderr.write(`[copy-notices] missing ${from}\n`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
copyFileSync(from, join(outDir, 'THIRD_PARTY_NOTICES.txt'));
process.stdout.write(`[copy-notices] copied THIRD_PARTY_NOTICES.txt to ${outDir}\n`);
