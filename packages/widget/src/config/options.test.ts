import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, isHexColor, isHttpUrl, isSiteKey, parseDataAttributes, parseFeatureList, resolveOptions, type WidgetOptions } from './options';

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

  it('ignores an invalid color, position or size', () => {
    const options = resolveOptions({
      color: 'red;background:url(x)',
      position: 'middle' as unknown as WidgetOptions['position'],
      size: 'huge' as unknown as WidgetOptions['size'],
    });
    expect(options.color).toBe(DEFAULT_OPTIONS.color);
    expect(options.position).toBe(DEFAULT_OPTIONS.position);
    expect(options.size).toBe(DEFAULT_OPTIONS.size);
    expect(resolveOptions({ color: '#abc' }, { color: 'nope' }).color).toBe('#abc');
  });

  it('lets later parts override earlier ones', () => {
    expect(resolveOptions({ size: 'small' }, { size: 'large' }).size).toBe('large');
  });

  it('accepts a string fontBaseUrl and ignores other types', () => {
    expect(resolveOptions({}).fontBaseUrl).toBeNull();
    expect(resolveOptions({ fontBaseUrl: 'https://cdn.test/fonts/' }).fontBaseUrl).toBe('https://cdn.test/fonts/');
    expect(resolveOptions({ fontBaseUrl: 5 as unknown as string }).fontBaseUrl).toBeNull();
  });
});

describe('connected-mode options', () => {
  it('reads the new data attributes', () => {
    const el = script({
      'data-mobile-position': 'bottom-center',
      'data-icon': 'contrast',
      'data-disabled-features': 'read-aloud, hide-images,,',
      'data-branding': 'false',
      'data-api': 'http://localhost:3000',
    });
    expect(parseDataAttributes(el)).toEqual({
      mobilePosition: 'bottom-center',
      icon: 'contrast',
      disabledFeatures: ['read-aloud', 'hide-images'],
      branding: false,
      apiBase: 'http://localhost:3000',
    });
    expect(parseDataAttributes(script({ 'data-branding': 'true' }))).toEqual({ branding: true });
  });

  it('ignores invalid new attributes', () => {
    const el = script({
      'data-mobile-position': 'middle',
      'data-icon': 'rocket',
      'data-api': 'javascript:alert(1)',
    });
    expect(parseDataAttributes(el)).toEqual({});
    expect(parseDataAttributes(script({ 'data-api': '/relative' }))).toEqual({});
  });

  it('has safe defaults', () => {
    expect(DEFAULT_OPTIONS).toMatchObject({
      mobilePosition: null,
      icon: 'person',
      disabledFeatures: [],
      branding: true,
      apiBase: 'https://api.pulxon.com',
    });
  });

  it('validates every known option in resolveOptions', () => {
    const options = resolveOptions({
      mobilePosition: 'middle' as unknown as WidgetOptions['mobilePosition'],
      icon: 'rocket' as unknown as WidgetOptions['icon'],
      disabledFeatures: ['ok-id', 'Bad Id'] as string[],
      branding: 'no' as unknown as boolean,
      apiBase: 'ftp://x',
      offsetX: 5000,
      offsetY: -1,
      lang: '<script>',
      hideOnMobile: 'yes' as unknown as boolean,
    });
    expect(options).toMatchObject({
      mobilePosition: null,
      icon: 'person',
      disabledFeatures: [],
      branding: true,
      apiBase: 'https://api.pulxon.com',
      offsetX: DEFAULT_OPTIONS.offsetX,
      offsetY: DEFAULT_OPTIONS.offsetY,
      lang: null,
      hideOnMobile: false,
    });
    expect(resolveOptions({ mobilePosition: 'top-left', disabledFeatures: ['read-aloud'], offsetX: 0, lang: 'en-US' })).toMatchObject({
      mobilePosition: 'top-left',
      disabledFeatures: ['read-aloud'],
      offsetX: 0,
      lang: 'en-US',
    });
    expect(resolveOptions({ mobilePosition: 'top-left' }, { mobilePosition: null }).mobilePosition).toBeNull();
  });

  it('parses feature lists and URLs strictly', () => {
    expect(parseFeatureList(' a-b ,c,, d ')).toEqual(['a-b', 'c', 'd']);
    expect(parseFeatureList('ok,NOT OK,<x>')).toEqual(['ok']);
    expect(parseFeatureList(Array.from({ length: 40 }, (_, i) => `f${i}`).join(','))).toHaveLength(30);
    expect(isHttpUrl('https://api.pulxon.com')).toBe(true);
    expect(isHttpUrl('http://localhost:3000/base')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('//api.pulxon.com')).toBe(false);
  });

  it('validates hex colors and site keys (the shared validators remote-config reuses)', () => {
    expect(isHexColor('#0f766e')).toBe(true);
    expect(isHexColor('#fff')).toBe(true);
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor(123)).toBe(false);
    expect(isSiteKey('pk_live_abcdefgh1234')).toBe(true);
    expect(isSiteKey('pk_test_abcdefgh1234')).toBe(true);
    expect(isSiteKey('../../admin')).toBe(false);
    expect(isSiteKey(123)).toBe(false);
  });
});

describe('data-lang normalization', () => {
  it('normalizes common spellings before validating', () => {
    expect(parseDataAttributes(script({ 'data-lang': 'ES' }))).toEqual({ lang: 'es' });
    expect(parseDataAttributes(script({ 'data-lang': 'es_MX' }))).toEqual({ lang: 'es-MX' });
    expect(parseDataAttributes(script({ 'data-lang': 'pt_br' }))).toEqual({ lang: 'pt-BR' });
  });

  it('still rejects invalid tags', () => {
    expect(parseDataAttributes(script({ 'data-lang': '<script>' }))).toEqual({});
    expect(parseDataAttributes(script({ 'data-lang': 'e' }))).toEqual({});
  });
});
