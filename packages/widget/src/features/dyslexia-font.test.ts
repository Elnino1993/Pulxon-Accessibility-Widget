import { afterEach, describe, expect, it } from 'vitest';
import { createStyleEngine } from '../core/style-engine';
import { DYSLEXIA_FONT_FAMILY, dyslexiaFont, fontFaceCss } from './dyslexia-font';
import { NOT_IGNORED } from './shared';

function makeCtx(fontBaseUrl: string | null) {
  return { doc: document, styles: createStyleEngine(document, { mode: 'style-tag' }), fontBaseUrl };
}

function styleText(): string | null {
  return document.head.querySelector('style[data-pulxon-style="dyslexia-font"]')?.textContent ?? null;
}

afterEach(() => {
  document.head.innerHTML = '';
});

describe('fontFaceCss', () => {
  it('builds @font-face rules from the base URL, adding a trailing slash', () => {
    const css = fontFaceCss('https://cdn.test/widget/fonts', document);
    expect(css).toContain(`font-family:"${DYSLEXIA_FONT_FAMILY}"`);
    expect(css).toContain('url("https://cdn.test/widget/fonts/opendyslexic-latin-400-normal.woff2") format("woff2")');
    expect(css).toContain('font-display:swap');
  });

  it('returns an empty string without a usable base URL', () => {
    expect(fontFaceCss(null, document)).toBe('');
    expect(fontFaceCss('', document)).toBe('');
  });

  it('percent-encodes characters that could break out of the CSS url()', () => {
    const css = fontFaceCss('https://cdn.test/a")}body{color:red}/', document);
    expect(css).not.toContain('")}body');
    expect(css).toContain('%22');
  });
});

describe('dyslexiaFont', () => {
  it('applies the font family to page text but not icons or the widget', () => {
    const ctx = makeCtx('https://cdn.test/fonts/');
    dyslexiaFont.apply(ctx, 1);
    const css = styleText() ?? '';
    expect(css).toContain('@font-face');
    expect(css).toContain(`body *${NOT_IGNORED}:not(i)`);
    expect(css).toContain(`font-family:"${DYSLEXIA_FONT_FAMILY}","OpenDyslexic","Comic Sans MS",sans-serif!important`);
    dyslexiaFont.teardown(ctx);
    expect(styleText()).toBeNull();
  });

  it('still sets the family without a font base URL', () => {
    dyslexiaFont.apply(makeCtx(null), 1);
    expect(styleText()).not.toContain('@font-face');
    expect(styleText()).toContain('"OpenDyslexic"');
  });
});
