import AdmZip from 'adm-zip';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPackages, PACKAGES, shouldCopyEntry, stripSourceMappingComment } from './build';

const here = dirname(fileURLToPath(import.meta.url));
const integrationsRoot = join(here, '..');
const repoRoot = join(integrationsRoot, '..');
const realWidgetDist = join(repoRoot, 'packages', 'widget', 'dist');
const realWidgetFile = join(realWidgetDist, 'pulxon.min.js');

/**
 * The widget's own version, read rather than typed: a hard-coded number here turns every release
 * into a test failure that says nothing about what actually broke.
 */
const WIDGET_VERSION = (JSON.parse(readFileSync(join(repoRoot, 'packages', 'widget', 'package.json'), 'utf8')) as { version: string }).version;

/** Every file under `dir`, relative to `dir`, applying the same filter `build.ts` applies when staging a package's source directory — so this can compute the exact file list a build should produce without duplicating build.ts's own walk logic by hand. */
function walkFiltered(dir: string, base: string = dir, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!shouldCopyEntry(full)) continue;
    if (statSync(full).isDirectory()) {
      walkFiltered(full, base, out);
    } else {
      out.push(relative(base, full).split('\\').join('/'));
    }
  }
  return out;
}

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
    expect(names).toEqual(
      [`mod_pulxon-${WIDGET_VERSION}.zip`, `pulxon-drupal-${WIDGET_VERSION}.zip`, `pulxon-wordpress-${WIDGET_VERSION}.zip`].sort(),
    );
    // A version that never made it into the name would leave every release overwriting the last.
    expect(WIDGET_VERSION).toMatch(/^\d+\.\d+\.\d+$/);

    for (const result of results) {
      expect(result.bytes).toBeGreaterThan(0);
    }
  });

  it('every package directory ships its own README (README.md or, for WordPress, readme.txt), so an owner who unzips a package gets install steps and a disclosure', () => {
    for (const pkg of PACKAGES) {
      const hasReadme = existsSync(join(pkg.sourceDir, 'README.md')) || existsSync(join(pkg.sourceDir, 'readme.txt'));
      expect(hasReadme, `${pkg.sourceDir} has no README.md or readme.txt`).toBe(true);
    }
  });

  it('refuses to package a widget build that lost its third-party notices', async () => {
    const outDir = makeTempDir('pulxon-build-');
    const partialDist = makeTempDir('pulxon-partial-dist-');
    writeFileSync(join(partialDist, 'pulxon.min.js'), '/*! banner */(function(){})();');
    await expect(buildPackages({ outDir, widgetDistDir: partialDist })).rejects.toThrow(/THIRD_PARTY_NOTICES/);
  });

  it('fails loudly, and writes nothing, when the widget has not been built', async () => {
    const outDir = makeTempDir('pulxon-build-');
    const emptyDistDir = makeTempDir('pulxon-empty-dist-');

    await expect(buildPackages({ outDir, widgetDistDir: emptyDistDir })).rejects.toThrow(/widget.*(not been built|missing|build)/i);
  });

  describe('each package zip', () => {
    for (const pkg of PACKAGES) {
      describe(pkg.zipBaseName, () => {
        it('contains the widget script, stripped of its sourceMappingURL comment, plus the two font files and both licence files, alongside the platform\'s own files', async () => {
          const outDir = makeTempDir('pulxon-build-');
          const [result] = await buildPackages({ outDir, only: [pkg.id] });
          expect(result, `buildPackages did not return a result for ${pkg.id}`).toBeDefined();
          const built = result!;

          const zip = new AdmZip(built.path);
          const entryNames = zip.getEntries().map((entry) => entry.entryName);
          const root = pkg.zipFolderName;

          const widgetEntry = zip.getEntry(`${root}/assets/pulxon.min.js`);
          expect(widgetEntry, entryNames.join('\n')).not.toBeNull();
          const shippedScript = widgetEntry!.getData().toString('utf8');
          expect(shippedScript).toBe(stripSourceMappingComment(readFileSync(realWidgetFile, 'utf8')));
          expect(shippedScript).not.toContain('sourceMappingURL');

          expect(entryNames).toContain(`${root}/assets/fonts/opendyslexic-latin-400-normal.woff2`);
          expect(entryNames).toContain(`${root}/assets/fonts/opendyslexic-latin-700-normal.woff2`);

          expect(entryNames).toContain(`${root}/LICENSE`);
          expect(entryNames).toContain(`${root}/LICENSE-widget-MIT.txt`);
          const widgetLicenseEntry = zip.getEntry(`${root}/LICENSE-widget-MIT.txt`);
          expect(widgetLicenseEntry!.getData().toString('utf8')).toBe(readFileSync(join(repoRoot, 'LICENSE'), 'utf8'));

          // The third-party notices the script's banner points at travel in the zip as well.
          const noticesEntry = zip.getEntry(`${root}/THIRD_PARTY_NOTICES.txt`);
          expect(noticesEntry, entryNames.join('\n')).not.toBeNull();
          const notices = noticesEntry!.getData().toString('utf8');
          expect(notices).toBe(readFileSync(join(realWidgetDist, 'THIRD_PARTY_NOTICES.txt'), 'utf8'));
          expect(notices).toContain('Copyright 2025 Benny Luk');
          expect(notices).toContain('Copyright (c) 2015-present Jason Miller');
          expect(shippedScript.startsWith('/*!')).toBe(true);

          for (const own of pkg.ownFiles) {
            expect(entryNames, `must contain the platform's own file ${own}`).toContain(`${root}/${own}`);
          }
        });

        it('ships no shipped script that still references a source map, since no zip carries the .map file', async () => {
          const outDir = makeTempDir('pulxon-build-');
          const [result] = await buildPackages({ outDir, only: [pkg.id] });
          expect(result, `buildPackages did not return a result for ${pkg.id}`).toBeDefined();
          const built = result!;
          const zip = new AdmZip(built.path);
          for (const entry of zip.getEntries()) {
            if (entry.isDirectory || !entry.entryName.endsWith('.js')) continue;
            expect(entry.getData().toString('utf8'), entry.entryName).not.toContain('sourceMappingURL');
          }
        });

        it('contains exactly the expected files — the platform\'s own (filtered) source directory plus the widget\'s built assets, nothing more', async () => {
          const outDir = makeTempDir('pulxon-build-');
          const [result] = await buildPackages({ outDir, only: [pkg.id] });
          expect(result, `buildPackages did not return a result for ${pkg.id}`).toBeDefined();
          const built = result!;
          const zip = new AdmZip(built.path);
          const root = pkg.zipFolderName;

          const fileEntries = zip
            .getEntries()
            .filter((entry) => !entry.isDirectory)
            .map((entry) => entry.entryName);

          const expected = [
            ...walkFiltered(pkg.sourceDir).map((rel) => `${root}/${rel}`),
            `${root}/assets/pulxon.min.js`,
            `${root}/THIRD_PARTY_NOTICES.txt`,
            ...walkFiltered(join(realWidgetDist, 'fonts')).map((rel) => `${root}/assets/fonts/${rel}`),
          ].sort();

          expect(fileEntries.sort()).toEqual(expected);
        });
      });
    }
  });

  describe('stripSourceMappingComment', () => {
    it('removes a trailing //# sourceMappingURL=... comment', () => {
      expect(stripSourceMappingComment('var a=1;\n//# sourceMappingURL=pulxon.min.js.map')).toBe('var a=1;');
    });

    it('leaves content with no sourceMappingURL comment untouched', () => {
      expect(stripSourceMappingComment('var a=1;')).toBe('var a=1;');
    });
  });

  describe('shouldCopyEntry', () => {
    it('excludes editor backups, OS junk files and node_modules', () => {
      expect(shouldCopyEntry(join('pkg', '.DS_Store'))).toBe(false);
      expect(shouldCopyEntry(join('pkg', 'Thumbs.db'))).toBe(false);
      expect(shouldCopyEntry(join('pkg', 'settings.php~'))).toBe(false);
      expect(shouldCopyEntry(join('pkg', '.settings.php.swp'))).toBe(false);
      expect(shouldCopyEntry(join('pkg', 'settings.php.bak'))).toBe(false);
      expect(shouldCopyEntry(join('pkg', 'node_modules'))).toBe(false);
      expect(shouldCopyEntry(join('pkg', '.git'))).toBe(false);
    });

    it('keeps the platform\'s own files', () => {
      expect(shouldCopyEntry(join('pkg', 'pulxon.php'))).toBe(true);
      expect(shouldCopyEntry(join('pkg', 'includes', 'settings.php'))).toBe(true);
      expect(shouldCopyEntry(join('pkg', 'README.md'))).toBe(true);
      expect(shouldCopyEntry(join('pkg', 'readme.txt'))).toBe(true);
    });

    it('actually keeps a stray editor backup or OS junk file out of a built zip', async () => {
      const stagingSource = makeTempDir('pulxon-junk-source-');
      mkdirSync(join(stagingSource, 'includes'));
      writeFileSync(join(stagingSource, 'pulxon.php'), '<?php // fixture\n');
      writeFileSync(join(stagingSource, 'includes', 'settings.php'), '<?php // fixture\n');
      writeFileSync(join(stagingSource, 'readme.txt'), 'fixture');
      writeFileSync(join(stagingSource, '.DS_Store'), 'junk');
      writeFileSync(join(stagingSource, 'settings.php~'), 'junk');
      mkdirSync(join(stagingSource, 'node_modules'));
      writeFileSync(join(stagingSource, 'node_modules', 'x.js'), 'junk');

      const files = walkFiltered(stagingSource);
      expect(files.sort()).toEqual(['includes/settings.php', 'pulxon.php', 'readme.txt'].sort());
    });
  });
});
