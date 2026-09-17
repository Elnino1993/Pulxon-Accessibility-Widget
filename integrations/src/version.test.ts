import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser, onErrorStopParsing } from '@xmldom/xmldom';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { readWidgetVersion } from './build';

/**
 * Four version declarations are hand-maintained across the platform packages, and nothing
 * checked them against `packages/widget/package.json` — the one place a build reads the
 * version from when naming a zip. A bump there drifted silently from all four, so a shipped
 * package could tell its own platform it was still the old version, and an update would never
 * apply. This file is the check: every declaration below must equal the widget's own version.
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => readFileSync(join(here, '..', relative), 'utf8');

const widgetVersion = readWidgetVersion();

// xmldom's own `Document` (returned by `parseFromString`) is not structurally compatible with
// the DOM lib's `Document`, so the local is typed as the parser's own return type rather than
// importing (or shadowing) the DOM lib's name.
type XmlDocument = ReturnType<DOMParser['parseFromString']>;

function parseXml(source: string): XmlDocument {
  const parser = new DOMParser({ onError: onErrorStopParsing });
  return parser.parseFromString(source, 'application/xml');
}

describe('every hand-maintained version declaration matches packages/widget/package.json', () => {
  it('the widget itself has a version to compare against', () => {
    expect(widgetVersion).toBeTruthy();
  });

  it('the WordPress plugin header "Version:"', () => {
    const plugin = read('wordpress/pulxon/pulxon.php');
    const match = plugin.match(/^\s*\*\s*Version:\s*([\w.\-]+)/m);
    expect(match, 'no "Version:" header found').not.toBeNull();
    expect(match![1]).toBe(widgetVersion);
  });

  it('the WordPress readme.txt "Stable tag:"', () => {
    const readme = read('wordpress/pulxon/readme.txt');
    const match = readme.match(/^Stable tag:\s*([\w.\-]+)/m);
    expect(match, 'no "Stable tag:" found').not.toBeNull();
    expect(match![1]).toBe(widgetVersion);
  });

  it('the Joomla manifest\'s <version>', () => {
    const doc = parseXml(read('joomla/mod_pulxon/mod_pulxon.xml'));
    const version = doc.getElementsByTagName('version').item(0)?.textContent?.trim();
    expect(version).toBe(widgetVersion);
  });

  it('the Drupal info file\'s version', () => {
    const info = parseYaml(read('drupal/pulxon/pulxon.info.yml')) as Record<string, unknown>;
    expect(String(info.version)).toBe(widgetVersion);
  });
});
