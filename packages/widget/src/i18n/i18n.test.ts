import { afterEach, describe, expect, it } from 'vitest';
import { createTranslator, normalizeLanguage, resolveLanguage } from './index';
import { en } from './locales/en';
import { es } from './locales/es';

afterEach(() => {
  document.documentElement.removeAttribute('lang');
});

describe('normalizeLanguage', () => {
  it('maps regional tags to supported base languages', () => {
    expect(normalizeLanguage('es-MX')).toBe('es');
    expect(normalizeLanguage('EN_us')).toBe('en');
    expect(normalizeLanguage('de')).toBeNull();
    expect(normalizeLanguage(undefined)).toBeNull();
  });
});

describe('resolveLanguage', () => {
  it('prefers the explicit language', () => {
    expect(resolveLanguage('es-MX', document, { languages: ['en-US'], language: 'en-US' })).toBe('es');
  });

  it('falls back to the html lang attribute', () => {
    document.documentElement.setAttribute('lang', 'es');
    expect(resolveLanguage(null, document, { languages: ['en'], language: 'en' })).toBe('es');
  });

  it('then uses navigator languages, then English', () => {
    expect(resolveLanguage('xx', document, { languages: ['de-DE', 'es-ES'], language: 'de-DE' })).toBe('es');
    expect(resolveLanguage(null, document, { languages: [], language: 'fr' })).toBe('en');
  });
});

describe('createTranslator', () => {
  it('translates with interpolation', () => {
    const t = createTranslator('es');
    expect(t('level.of', { current: 2, total: 4 })).toBe('Nivel 2 de 4');
  });

  it('falls back to English for unknown languages', () => {
    expect(createTranslator('zz')('panel.title')).toBe('Accessibility');
  });

  it('keeps unknown placeholders untouched', () => {
    expect(createTranslator('en')('level.of', { current: 1 })).toBe('Level 1 of {total}');
  });
});

describe('locales', () => {
  it('Spanish has exactly the English keys', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });
});
