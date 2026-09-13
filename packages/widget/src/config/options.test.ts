import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, parseDataAttributes, resolveOptions } from './options';

function script(attrs: Record<string, string>): HTMLScriptElement {
  const el = document.createElement('script');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
}

describe('parseDataAttributes', () => {
  it('returns an empty object for null', () => {
    expect(parseDataAttributes(null)).toEqual({});
  });

  it('reads all valid attributes', () => {
    const el = script({
      'data-position': 'top-left',
      'data-offset': '10, 30',
      'data-color': '#ff0000',
      'data-size': 'large',
      'data-lang': 'es',
      'data-hide-on-mobile': 'true',
      'data-trigger': '#a11y',
      'data-nonce': 'n0nce',
      'data-site-key': 'pk_live_abc12345',
      'data-z-index': '999',
    });
    expect(parseDataAttributes(el)).toEqual({
      position: 'top-left',
      offsetX: 10,
      offsetY: 30,
      color: '#ff0000',
      size: 'large',
      lang: 'es',
      hideOnMobile: true,
      trigger: '#a11y',
      nonce: 'n0nce',
      siteKey: 'pk_live_abc12345',
      zIndex: 999,
    });
  });

  it('ignores invalid values', () => {
    const el = script({
      'data-position': 'middle',
      'data-offset': 'a,b',
      'data-color': 'red;background:url(x)',
      'data-size': 'huge',
      'data-site-key': '<script>',
      'data-z-index': 'top',
    });
    expect(parseDataAttributes(el)).toEqual({});
  });
});

describe('resolveOptions', () => {
  it('applies defaults and skips undefined values', () => {
    const options = resolveOptions({ color: '#000000', lang: undefined });
    expect(options.color).toBe('#000000');
    expect(options.lang).toBe(DEFAULT_OPTIONS.lang);
    expect(options.position).toBe('bottom-right');
  });

  it('lets later parts override earlier ones', () => {
    expect(resolveOptions({ size: 'small' }, { size: 'large' }).size).toBe('large');
  });
});
