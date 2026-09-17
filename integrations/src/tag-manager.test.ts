import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const templateSource = readFileSync(join(here, '..', 'tag-manager', 'pulxon-template.tpl'), 'utf8');
const readmeSource = readFileSync(join(here, '..', 'tag-manager', 'README.md'), 'utf8');

const REQUIRED_SECTIONS = ['___INFO___', '___TEMPLATE_PARAMETERS___', '___SANDBOXED_JS_FOR_WEB_TEMPLATE___', '___WEB_PERMISSIONS___', '___TESTS___'];

/**
 * `.tpl` sections are separated by `___NAME___` markers. Splits the whole
 * file on those markers and returns a map of section name -> body text, so
 * each assertion below can look at exactly one section instead of regexing
 * the whole file.
 */
function splitSections(source: string): Map<string, string> {
  const marker = /^___([A-Z_]+)___\s*$/gm;
  const matches = [...source.matchAll(marker)];
  const sections = new Map<string, string>();
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const name = `___${match[1]}___`;
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? source.length) : source.length;
    sections.set(name, source.slice(start, end).trim());
  }
  return sections;
}

/**
 * Tag Manager's `___INFO___`/`___TEMPLATE_PARAMETERS___` blocks are plain
 * JSON in every real-world `.tpl` file; this tolerant parse only exists so a
 * trailing comma (easy to leave in by hand) doesn't make the test brittle.
 */
function tolerantJsonParse(text: string): unknown {
  return JSON.parse(text.replace(/,(\s*[\]}])/g, '$1'));
}

describe('the Tag Manager template sections', () => {
  it('has every required section, in order', () => {
    const positions = REQUIRED_SECTIONS.map((section) => {
      const index = templateSource.indexOf(section);
      expect(index, `missing section ${section}`).toBeGreaterThanOrEqual(0);
      return index;
    });
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });
});

describe('___INFO___', () => {
  const info = tolerantJsonParse(splitSections(templateSource).get('___INFO___') ?? '') as Record<string, unknown>;

  it('parses as JSON and names the template', () => {
    expect(typeof info.displayName).toBe('string');
    expect((info.displayName as string).length).toBeGreaterThan(0);
  });

  it('describes what the template does and what it does not do', () => {
    expect(typeof info.description).toBe('string');
    expect((info.description as string).length).toBeGreaterThan(0);
  });

  it('declares at least one category', () => {
    expect(Array.isArray(info.categories)).toBe(true);
    expect((info.categories as unknown[]).length).toBeGreaterThan(0);
  });
});

describe('___TEMPLATE_PARAMETERS___', () => {
  const params = tolerantJsonParse(splitSections(templateSource).get('___TEMPLATE_PARAMETERS___') ?? '') as Array<Record<string, unknown>>;

  it('parses as a JSON array', () => {
    expect(Array.isArray(params)).toBe(true);
    expect(params.length).toBeGreaterThan(0);
  });

  it('gives every parameter a name and a type', () => {
    for (const param of params) {
      expect(typeof param.name, JSON.stringify(param)).toBe('string');
      expect((param.name as string).length).toBeGreaterThan(0);
      expect(typeof param.type, JSON.stringify(param)).toBe('string');
    }
  });

  it('takes only the script URL — Tag Manager cannot set data-* attributes on an injected script, so there is nothing else to configure here', () => {
    expect(params.length).toBe(1);
    expect(params[0].name).toBe('scriptUrl');
  });
});

describe('___SANDBOXED_JS_FOR_WEB_TEMPLATE___', () => {
  const code = splitSections(templateSource).get('___SANDBOXED_JS_FOR_WEB_TEMPLATE___') ?? '';

  it('injects the script through the sandboxed injectScript API', () => {
    expect(code).toContain("require('injectScript')");
    expect(code).toMatch(/\binjectScript\s*\(/);
  });

  it('reports success and failure back to Tag Manager', () => {
    expect(code).toContain("require('gtmOnSuccess')");
    expect(code).toContain("require('gtmOnFailure')");
  });

  it('never touches the raw DOM, the raw window, or eval — only Tag Manager\'s sandboxed APIs', () => {
    expect(code).not.toMatch(/\bdocument\s*\./);
    expect(code).not.toMatch(/\bwindow\s*\./);
    expect(code).not.toMatch(/\beval\s*\(/);
  });
});

describe('___WEB_PERMISSIONS___', () => {
  const permissions = tolerantJsonParse(splitSections(templateSource).get('___WEB_PERMISSIONS___') ?? '') as Array<{
    instance?: { key?: { publicId?: string }; param?: Array<{ key: string; value: { listItem?: Array<{ string?: string }> } }> };
  }>;

  it('declares exactly one inject_script permission', () => {
    const injectScriptPermissions = permissions.filter((entry) => entry.instance?.key?.publicId === 'inject_script');
    expect(injectScriptPermissions.length).toBe(1);
  });

  it('names the exact host the template injects from, and nothing wider', () => {
    const [permission] = permissions.filter((entry) => entry.instance?.key?.publicId === 'inject_script');
    const urlsParam = permission.instance?.param?.find((p) => p.key === 'urls');
    const urls = urlsParam?.value.listItem?.map((item) => item.string) ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url, 'must be scoped to https://cdn.jsdelivr.net, not a wildcard host').toMatch(/^https:\/\/cdn\.jsdelivr\.net\//);
      // No bare-host or cross-origin wildcard: this must not be able to inject from any domain.
      expect(url).not.toBe('https://cdn.jsdelivr.net/*');
      expect(url).not.toMatch(/^https?:\*/);
      expect(url).not.toBe('<all_urls>');
    }
  });
});

describe('___TESTS___', () => {
  const testsSection = splitSections(templateSource).get('___TESTS___') ?? '';

  it('has at least one test scenario', () => {
    const scenarioCount = (testsSection.match(/^-\s+name:/gm) ?? []).length;
    expect(scenarioCount).toBeGreaterThan(0);
  });
});

describe('the Tag Manager template as a whole', () => {
  it('makes no compliance or legal claim', () => {
    expect(templateSource).not.toMatch(/\b(ADA|WCAG compliant|compliance|certified|lawsuit)\b/i);
  });
});

describe('tag-manager/README.md', () => {
  it('explains the data-* attribute limitation plainly, so nobody expects options to work the way they do in the other packages', () => {
    expect(readmeSource).toMatch(/data-\*/);
    expect(readmeSource.toLowerCase()).toContain('inject');
  });

  it('says how to import the template', () => {
    expect(readmeSource.toLowerCase()).toMatch(/template gallery|import/);
  });

  it('makes no compliance or legal claim', () => {
    expect(readmeSource).not.toMatch(/\b(ADA|WCAG compliant|compliance|certified|lawsuit)\b/i);
  });
});
