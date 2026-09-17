import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Every package and snippet in this repository ships or points at the widget's own files —
 * none of them may depend on a jsDelivr or unpkg URL, both because `@pulxon/widget` has never
 * been published to npm (the URL 404s today) and because the rest of this branch already
 * self-hosts. This walks every file under `integrations/` (excluding build output and
 * dependencies) and fails if any of them still mentions one of those two hosts.
 */
const here = dirname(fileURLToPath(import.meta.url));
const integrationsRoot = join(here, '..');
const thisFile = fileURLToPath(import.meta.url);

const EXCLUDED_DIR_NAMES = new Set(['node_modules', 'dist', '.vite']);
const FORBIDDEN = /jsdelivr\.net|unpkg\.com/i;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIR_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

describe('no file under integrations/ points at a third-party CDN', () => {
  it('every package and snippet self-hosts the widget instead of depending on jsDelivr or unpkg', () => {
    const files = walk(integrationsRoot).filter((file) => file !== thisFile);
    const offenders: string[] = [];

    for (const file of files) {
      let content: string;
      try {
        content = readFileSync(file, 'utf8');
      } catch {
        continue; // Not a text file (or unreadable) — nothing to scan.
      }
      if (FORBIDDEN.test(content)) {
        offenders.push(relative(integrationsRoot, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
