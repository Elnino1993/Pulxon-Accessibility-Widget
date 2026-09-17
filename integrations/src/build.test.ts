import AdmZip from 'adm-zip';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPackages, PACKAGES } from './build';

const here = dirname(fileURLToPath(import.meta.url));
const integrationsRoot = join(here, '..');
const repoRoot = join(integrationsRoot, '..');
const realWidgetDist = join(repoRoot, 'packages', 'widget', 'dist');
const realWidgetFile = join(realWidgetDist, 'pulxon.min.js');

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('buildPackages', () => {
  it('writes one zip per package, named after the package and the widget version', async () => {
    const outDir = makeTempDir('pulxon-build-');
    const results = await buildPackages({ outDir });

    const names = results.map((r) => r.name).sort();
    expect(names).toEqual(['mod_pulxon-0.4.0.zip', 'pulxon-drupal-0.4.0.zip', 'pulxon-wordpress-0.4.0.zip'].sort());

    for (const result of results) {
      expect(result.bytes).toBeGreaterThan(0);
    }
  });

  it('fails loudly, and writes nothing, when the widget has not been built', async () => {
    const outDir = makeTempDir('pulxon-build-');
    const emptyDistDir = makeTempDir('pulxon-empty-dist-');

    await expect(buildPackages({ outDir, widgetDistDir: emptyDistDir })).rejects.toThrow(/widget.*(not been built|missing|build)/i);
  });

  describe('each package zip', () => {
    for (const pkg of PACKAGES) {
      describe(pkg.zipBaseName, () => {
        it('contains the widget script, byte-identical to packages/widget/dist/pulxon.min.js, plus the two font files and both licence files, alongside the platform\'s own files', async () => {
          const outDir = makeTempDir('pulxon-build-');
          const [result] = await buildPackages({ outDir, only: [pkg.id] });

          const zip = new AdmZip(result.path);
          const entryNames = zip.getEntries().map((entry) => entry.entryName);
          const root = pkg.zipFolderName;

          const widgetEntry = zip.getEntry(`${root}/assets/pulxon.min.js`);
          expect(widgetEntry, entryNames.join('\n')).not.toBeNull();
          expect(widgetEntry!.getData().equals(readFileSync(realWidgetFile))).toBe(true);

          expect(entryNames).toContain(`${root}/assets/fonts/opendyslexic-latin-400-normal.woff2`);
          expect(entryNames).toContain(`${root}/assets/fonts/opendyslexic-latin-700-normal.woff2`);

          expect(entryNames).toContain(`${root}/LICENSE`);
          expect(entryNames).toContain(`${root}/LICENSE-widget-MIT.txt`);
          const widgetLicenseEntry = zip.getEntry(`${root}/LICENSE-widget-MIT.txt`);
          expect(widgetLicenseEntry!.getData().toString('utf8')).toBe(readFileSync(join(repoRoot, 'LICENSE'), 'utf8'));

          for (const own of pkg.ownFiles) {
            expect(entryNames, `must contain the platform's own file ${own}`).toContain(`${root}/${own}`);
          }
        });
      });
    }
  });
});
