import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const readmeSource = readFileSync(join(here, '..', 'README.md'), 'utf8');

/** The README's paragraphs, split on blank lines: [0] is the "# Pulxon integrations" heading, [1] is the opening paragraph. */
const paragraphs = readmeSource.split(/\n{2,}/);
const openingParagraph = paragraphs[1] ?? '';

describe('integrations/README.md', () => {
  it('opens by describing every install path this repository ships, not just the packages and snippets — the Tag Manager template is one too', () => {
    // The opening paragraph is written when this repository shipped only packages and
    // snippets, both of which are self-hosted (no CDN). The Tag Manager template is a third,
    // later addition (see the "What each package is" table) that is just as CDN-independent,
    // but the opening sentence's own subject never mentioned it — so a reader stops at the
    // first paragraph with a narrower idea of what "no CDN" actually covers than is true.
    expect(openingParagraph.toLowerCase()).toContain('tag manager');
  });

  it('does not overclaim: everything the opening paragraph covers really is CDN-independent', () => {
    expect(openingParagraph).not.toMatch(/jsdelivr\.net|unpkg\.com/i);
  });
});
