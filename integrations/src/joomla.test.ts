import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser, onErrorStopParsing } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => readFileSync(join(here, '..', relative), 'utf8');

const MODULE_DIR = 'joomla/mod_pulxon';

const manifestSource = read(`${MODULE_DIR}/mod_pulxon.xml`);
const modulePhp = read(`${MODULE_DIR}/mod_pulxon.php`);
const templatePhp = read(`${MODULE_DIR}/tmpl/default.php`);

/**
 * The exact shape `SITE_KEY` in `packages/widget/src/config/options.ts` accepts — hand-copied,
 * not imported, the same way `POSITIONS`/`SIZES`/`ICONS` are hand-copied below. Joomla's
 * `validate="regex"` `pattern` attribute takes the raw pattern with no delimiters, so this is
 * exactly what should appear there.
 */
const SITE_KEY_PATTERN_SOURCE = 'pk_(?:live|test)_[A-Za-z0-9]{8,64}';

// The same closed lists the WordPress plugin and `packages/widget/src/config/options.ts`
// use, spelled exactly the same way, so the module's <option> lists cannot drift from what
// the widget itself accepts.
const POSITIONS = ['top-left', 'top-center', 'top-right', 'center-left', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'];
const SIZES = ['small', 'medium', 'large'];
const ICONS = ['person', 'eye', 'contrast'];

function parseXml(source: string): Document {
  const parser = new DOMParser({ onError: onErrorStopParsing });
  return parser.parseFromString(source, 'application/xml');
}

function fieldsByName(doc: Document): Map<string, Element> {
  const fields = new Map<string, Element>();
  const nodes = doc.getElementsByTagName('field');
  for (let i = 0; i < nodes.length; i += 1) {
    const field = nodes.item(i);
    if (!field) continue;
    const name = field.getAttribute('name');
    if (name) fields.set(name, field);
  }
  return fields;
}

function optionValues(field: Element): string[] {
  const options = field.getElementsByTagName('option');
  const values: string[] = [];
  for (let i = 0; i < options.length; i += 1) {
    values.push(options.item(i)?.getAttribute('value') ?? '');
  }
  return values;
}

describe('the Joomla module manifest', () => {
  it('is well-formed XML', () => {
    expect(() => parseXml(manifestSource)).not.toThrow();
  });

  it('declares a site module with a version and its shipped files', () => {
    const doc = parseXml(manifestSource);
    const extension = doc.documentElement;
    expect(extension.tagName).toBe('extension');
    expect(extension.getAttribute('type')).toBe('module');
    expect(extension.getAttribute('client')).toBe('site');

    const version = doc.getElementsByTagName('version').item(0);
    expect(version?.textContent?.trim()).toBeTruthy();

    const files = doc.getElementsByTagName('files').item(0);
    expect(files).not.toBeNull();
    const filenames = Array.from({ length: files?.getElementsByTagName('filename').length ?? 0 }, (_, i) =>
      files?.getElementsByTagName('filename').item(i)?.textContent?.trim(),
    );
    expect(filenames).toContain('mod_pulxon.php');
    const folders = Array.from({ length: files?.getElementsByTagName('folder').length ?? 0 }, (_, i) =>
      files?.getElementsByTagName('folder').item(i)?.textContent?.trim(),
    );
    expect(folders).toContain('tmpl');
    expect(folders).toContain('assets');
  });

  it('names both licence files in <files>, so Joomla installs them instead of discarding them', () => {
    // Joomla's installer copies only what <files> lists. The build (src/build.ts) ships
    // LICENSE (this module's own GPL notice) and LICENSE-widget-MIT.txt (the bundled
    // widget's MIT notice, required by the legal constraints) alongside mod_pulxon.php —
    // if either is missing from <files>, Joomla silently drops it at install time.
    const doc = parseXml(manifestSource);
    const files = doc.getElementsByTagName('files').item(0);
    expect(files).not.toBeNull();
    const filenames = Array.from({ length: files?.getElementsByTagName('filename').length ?? 0 }, (_, i) =>
      files?.getElementsByTagName('filename').item(i)?.textContent?.trim(),
    );
    expect(filenames).toContain('LICENSE');
    expect(filenames).toContain('LICENSE-widget-MIT.txt');
  });

  it('names README.md in <files>, so Joomla installs it instead of discarding it', () => {
    const doc = parseXml(manifestSource);
    const files = doc.getElementsByTagName('files').item(0);
    expect(files).not.toBeNull();
    const filenames = Array.from({ length: files?.getElementsByTagName('filename').length ?? 0 }, (_, i) =>
      files?.getElementsByTagName('filename').item(i)?.textContent?.trim(),
    );
    expect(filenames).toContain('README.md');
  });

  it('declares a <config> with one field per option, each with name, type and label', () => {
    const doc = parseXml(manifestSource);
    const config = doc.getElementsByTagName('config').item(0);
    expect(config).not.toBeNull();

    const fields = fieldsByName(doc);
    const expectedOptionFields = ['site_key', 'position', 'size', 'icon', 'color', 'lang', 'statement_url', 'hide_on_mobile', 'branding'];
    for (const name of expectedOptionFields) {
      const field = fields.get(name);
      expect(field, `field "${name}" must exist`).toBeDefined();
      expect(field?.getAttribute('name')).toBe(name);
      expect(field?.getAttribute('type')).toBeTruthy();
      expect(field?.getAttribute('label')).toBeTruthy();
    }
  });

  it('gives every choice field an <option> list matching the widget\'s accepted values', () => {
    const doc = parseXml(manifestSource);
    const fields = fieldsByName(doc);

    expect(optionValues(fields.get('position')!)).toEqual(POSITIONS);
    expect(optionValues(fields.get('size')!)).toEqual(SIZES);
    expect(optionValues(fields.get('icon')!)).toEqual(ICONS);
    expect(optionValues(fields.get('lang')!)).toEqual(['', 'en', 'es']);
  });

  it('puts the site key field first, before every other option field', () => {
    const doc = parseXml(manifestSource);
    const fieldset = doc.getElementsByTagName('fieldset').item(0);
    expect(fieldset).not.toBeNull();
    const fields = fieldset!.getElementsByTagName('field');
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.item(0)?.getAttribute('name')).toBe('site_key');
  });

  it('validates the site key field against the widget\'s own accepted shape, and tells the owner where to find it', () => {
    const doc = parseXml(manifestSource);
    const fields = fieldsByName(doc);
    const siteKey = fields.get('site_key');
    expect(siteKey).toBeDefined();
    expect(siteKey?.getAttribute('type')).toBe('text');
    expect(siteKey?.getAttribute('validate')).toBe('regex');
    expect(siteKey?.getAttribute('pattern')).toBe(SITE_KEY_PATTERN_SOURCE);
    expect(siteKey?.getAttribute('description')).toMatch(/pulxon dashboard/i);
    expect(siteKey?.getAttribute('description')).toMatch(/leav(e|ing)[^.]*empty/i);
  });
});

describe('mod_pulxon.php', () => {
  it('refuses to run when loaded directly', () => {
    expect(modulePhp).toMatch(/defined\(\s*'_JEXEC'\s*\)\s*or\s*die;/);
  });

  it('re-validates the site key against the widget\'s own pattern before handing it to the template', () => {
    // The manifest's validate="regex" rule only runs when an administrator saves through
    // Joomla's own module-edit UI; a directly-edited params.ini bypasses it entirely. This is
    // the defense-in-depth re-check, the same discipline every other value in this module gets.
    expect(modulePhp).toContain(SITE_KEY_PATTERN_SOURCE);
    expect(modulePhp).toMatch(/preg_match/);
    expect(modulePhp).toMatch(/\$siteKey\s*=/);
  });
});

describe('tmpl/default.php', () => {
  it('escapes every value it echoes with htmlspecialchars(..., ENT_QUOTES, \'UTF-8\')', () => {
    // Any `echo $something` that is not immediately an htmlspecialchars(...) call is a
    // cross-site scripting hole: module params are attacker-controlled the moment a site
    // has a second administrator.
    const unescaped = [...templatePhp.matchAll(/echo\s+(?!htmlspecialchars\()\$/g)];
    expect(unescaped.map((match) => templatePhp.slice(match.index, (match.index ?? 0) + 60))).toEqual([]);

    const escapeCalls = [...templatePhp.matchAll(/htmlspecialchars\([^)]*\)/g)];
    expect(escapeCalls.length).toBeGreaterThan(0);
    for (const call of escapeCalls) {
      expect(call[0]).toMatch(/ENT_QUOTES/);
      expect(call[0]).toMatch(/'UTF-8'/);
    }
  });

  it('refuses to run when loaded directly', () => {
    expect(templatePhp).toMatch(/defined\(\s*'_JEXEC'\s*\)\s*or\s*die;/);
  });

  it('emits data-site-key when a site key is set', () => {
    expect(templatePhp).toContain('$siteKey');
    expect(templatePhp).toContain('data-site-key=');
  });
});

describe('the Joomla module as a whole', () => {
  it('makes no compliance or legal claim', () => {
    expect(`${manifestSource}${modulePhp}${templatePhp}`).not.toMatch(/\b(ADA|WCAG compliant|compliance|certified|lawsuit)\b/i);
  });

  it('ships its own README.md, disclosing that it has never been executed and telling the owner to publish the module with style="none"', () => {
    const readme = read(`${MODULE_DIR}/README.md`);
    expect(readme).toMatch(/has not been (run|executed)/i);
    expect(readme).toMatch(/staging/i);
    expect(readme).toMatch(/<\/body>/);
    expect(readme).toMatch(/settings save/i);
    expect(readme).toMatch(/widget opens/i);
    expect(readme).toMatch(/style="none"/);
  });
});
