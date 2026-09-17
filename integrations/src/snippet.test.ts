import { describe, expect, it } from 'vitest';
import { buildScriptTag } from './snippet';

describe('buildScriptTag', () => {
  it('emits the smallest possible tag when nothing is configured', () => {
    expect(buildScriptTag({ src: '/pulxon/pulxon.min.js' })).toBe('<script src="/pulxon/pulxon.min.js" defer></script>');
  });

  it('adds only the attributes that were set', () => {
    expect(buildScriptTag({ src: '/w.js', position: 'bottom-left', color: '#1f4bff' })).toBe(
      '<script src="/w.js" data-position="bottom-left" data-color="#1f4bff" defer></script>',
    );
  });

  it('writes the booleans the way the widget reads them', () => {
    expect(buildScriptTag({ src: '/w.js', hideOnMobile: true, branding: false })).toBe(
      '<script src="/w.js" data-hide-on-mobile="true" data-branding="false" defer></script>',
    );
  });

  it('omits a boolean that is at its default', () => {
    expect(buildScriptTag({ src: '/w.js', hideOnMobile: false, branding: true })).toBe('<script src="/w.js" defer></script>');
  });

  it('escapes every value it writes into an attribute', () => {
    const tag = buildScriptTag({ src: '/w.js', statementUrl: 'https://example.com/a?b=1&c=2', color: '"><script>alert(1)</script>' });
    expect(tag).toContain('data-statement-url="https://example.com/a?b=1&amp;c=2"');
    expect(tag).not.toContain('<script>alert(1)');
    expect(tag.match(/<script/g)).toHaveLength(1);
  });

  it('keeps the attribute order stable, so a diff of a generated file is readable', () => {
    const first = buildScriptTag({ src: '/w.js', color: '#000000', position: 'top-left' });
    const second = buildScriptTag({ position: 'top-left', color: '#000000', src: '/w.js' });
    expect(first).toBe(second);
  });
});
