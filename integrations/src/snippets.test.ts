import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildScriptTag } from './snippet';
import { renderSnippet, SNIPPET_PLATFORMS, WIDGET_SRC } from './generate-snippets';

const here = dirname(fileURLToPath(import.meta.url));
const snippetsDir = join(here, '..', 'snippets');
const readmeSource = readFileSync(join(snippetsDir, 'README.md'), 'utf8');

describe('each platform snippet', () => {
  for (const platform of SNIPPET_PLATFORMS) {
    describe(platform.file, () => {
      const source = readFileSync(join(snippetsDir, platform.file), 'utf8');

      it('is generated from buildScriptTag, not hand-typed, so it cannot drift from the widget', () => {
        expect(source).toBe(renderSnippet(platform));
      });

      it('contains exactly the tag buildScriptTag produces for the shared widget URL', () => {
        expect(source).toContain(buildScriptTag({ src: WIDGET_SRC }));
        // Only one <script> tag: no leftover placeholder or duplicate tag.
        expect(source.match(/<script\b/g) ?? []).toHaveLength(1);
      });

      it('carries a comment naming where it goes', () => {
        expect(source).toContain(platform.installLocation);
      });

      it('carries a comment telling the owner to upload the widget files first, since the script now loads from their own site', () => {
        expect(source).toMatch(/upload/i);
        expect(source).toContain('/pulxon/');
        expect(source).toMatch(/fonts/i);
      });

      it('points at a path on the owner\'s own site, not a third-party CDN', () => {
        expect(source).not.toMatch(/jsdelivr\.net|unpkg\.com/i);
        expect(source).toContain(WIDGET_SRC);
      });
    });
  }

  it("Shopify's snippet names layout/theme.liquid and </body>, as the brief requires", () => {
    const shopify = SNIPPET_PLATFORMS.find((p) => p.id === 'shopify');
    expect(shopify).toBeDefined();
    const source = readFileSync(join(snippetsDir, shopify!.file), 'utf8');
    expect(source).toContain('layout/theme.liquid');
    expect(source).toContain('</body>');
  });
});

describe('snippets/README.md', () => {
  it('lists every platform that gets a copy-paste snippet', () => {
    for (const platform of SNIPPET_PLATFORMS) {
      expect(readmeSource, `README must mention ${platform.displayName}`).toContain(platform.displayName);
    }
  });

  it('explains that a site key, color and the other options must be added to the tag by hand', () => {
    expect(readmeSource).toMatch(/data-\*/);
  });

  it('makes no compliance or legal claim', () => {
    expect(readmeSource).not.toMatch(/\b(ADA|WCAG compliant|compliance|certified|lawsuit)\b/i);
  });

  it('tells the owner to self-host by uploading the widget files, not to rely on jsDelivr or unpkg', () => {
    expect(readmeSource).not.toMatch(/jsdelivr\.net|unpkg\.com/i);
    expect(readmeSource).toContain('/pulxon/');
    expect(readmeSource).toMatch(/upload/i);
  });
});

describe('the snippets as a whole', () => {
  it('make no compliance or legal claim', () => {
    const all = SNIPPET_PLATFORMS.map((p) => readFileSync(join(snippetsDir, p.file), 'utf8')).join('\n');
    expect(all).not.toMatch(/\b(ADA|WCAG compliant|compliance|certified|lawsuit)\b/i);
  });
});
