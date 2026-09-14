import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontPackage = join(packageRoot, 'node_modules', '@fontsource', 'opendyslexic');
const outDir = join(packageRoot, 'dist', 'fonts');
const FILES = ['opendyslexic-latin-400-normal.woff2', 'opendyslexic-latin-700-normal.woff2'];

function copy(from, to) {
  if (!existsSync(from)) {
    process.stderr.write(`[copy-fonts] missing ${from}\n`);
    process.exit(1);
  }
  copyFileSync(from, to);
}

mkdirSync(outDir, { recursive: true });
for (const file of FILES) copy(join(fontPackage, 'files', file), join(outDir, file));
copy(join(fontPackage, 'LICENSE'), join(outDir, 'OpenDyslexic-LICENSE.txt'));
process.stdout.write(`[copy-fonts] copied ${FILES.length} fonts and the license to ${outDir}\n`);
