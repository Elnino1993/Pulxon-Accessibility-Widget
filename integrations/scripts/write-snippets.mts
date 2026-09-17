/**
 * One-off maintenance script: writes every file under `integrations/snippets/`
 * from `renderSnippet`/`SNIPPET_PLATFORMS` in `../src/generate-snippets.ts`,
 * so the checked-in files are always byte-identical to what that module
 * produces. Run with `tsx integrations/scripts/write-snippets.mts` after
 * changing `snippet.ts` or `generate-snippets.ts`, then run the tests.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSnippet, SNIPPET_PLATFORMS } from '../src/generate-snippets.ts';

const here = dirname(fileURLToPath(import.meta.url));
const snippetsDir = join(here, '..', 'snippets');

for (const platform of SNIPPET_PLATFORMS) {
  const path = join(snippetsDir, platform.file);
  writeFileSync(path, renderSnippet(platform), 'utf8');
  console.log(`wrote ${path}`);
}
