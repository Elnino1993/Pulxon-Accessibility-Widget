import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocaleLoader, createTranslator, LANGUAGES, normalizeLanguage, resolveLanguage, sanitizeMessages, type MessageKey } from './index';
import { en } from './locales/en';

const LOCALES_DIR = join(__dirname, '..', '..', 'locales');

function readLocale(code: string): Record<string, string> {
  return JSON.parse(readFileSync(join(LOCALES_DIR, `${code}.json`), 'utf8')) as Record<string, string>;
}

const placeholders = (text: string): string =>
  [...text.matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1])
    .sort()
    .join(',');

afterEach(() => {
  document.documentElement.removeAttribute('lang');
});

describe('normalizeLanguage', () => {
  it('maps regional tags to the shipped language', () => {
    expect(normalizeLanguage('es-MX')).toBe('es');
    expect(normalizeLanguage('EN_us')).toBe('en');
    expect(normalizeLanguage('de-AT')).toBe('de');
    expect(normalizeLanguage('pt-BR')).toBe('pt');
    expect(normalizeLanguage('xx')).toBeNull();
    expect(normalizeLanguage(undefined)).toBeNull();
  });

  it('tells the two Chinese scripts and the two Serbian scripts apart', () => {
    expect(normalizeLanguage('zh-CN')).toBe('zh-Hans');
    expect(normalizeLanguage('zh')).toBe('zh-Hans');
    expect(normalizeLanguage('zh-TW')).toBe('zh-Hant');
    expect(normalizeLanguage('zh-Hant-HK')).toBe('zh-Hant');
    expect(normalizeLanguage('sr-Cyrl-RS')).toBe('sr-SP');
    expect(normalizeLanguage('sr-Latn')).toBe('sr');
  });

  it('understands the tags browsers use for Norwegian, Filipino, Hebrew and Indonesian', () => {
    expect(normalizeLanguage('nb-NO')).toBe('no');
    expect(normalizeLanguage('nn')).toBe('no');
    expect(normalizeLanguage('tl')).toBe('fil');
    expect(normalizeLanguage('iw')).toBe('he');
    expect(normalizeLanguage('in')).toBe('id');
  });
});

describe('resolveLanguage', () => {
  it('prefers the explicit language', () => {
    expect(resolveLanguage('es-MX', document, { languages: ['en-US'], language: 'en-US' })).toBe('es');
  });

  it('falls back to the html lang attribute', () => {
    document.documentElement.setAttribute('lang', 'de');
    expect(resolveLanguage(null, document, { languages: ['en'], language: 'en' })).toBe('de');
  });

  it('then uses navigator languages, then English', () => {
    expect(resolveLanguage('xx', document, { languages: ['xx-YY', 'fr-FR'], language: 'xx-YY' })).toBe('fr');
    expect(resolveLanguage(null, document, { languages: [], language: 'zz' })).toBe('en');
  });
});

describe('createTranslator', () => {
  it('translates with interpolation from loaded messages', () => {
    const t = createTranslator('es', { 'level.of': 'Nivel {current} de {total}' });
    expect(t('level.of', { current: 2, total: 4 })).toBe('Nivel 2 de 4');
  });

  it('falls back to English, per key, for whatever a language does not translate', () => {
    const t = createTranslator('es', { 'level.of': 'Nivel {current} de {total}' });
    expect(t('panel.title')).toBe('Accessibility');
    expect(createTranslator('zz')('panel.title')).toBe('Accessibility');
  });

  it('keeps unknown placeholders untouched', () => {
    expect(createTranslator('en')('level.of', { current: 1 })).toBe('Level 1 of {total}');
  });
});

describe('sanitizeMessages', () => {
  it('keeps strings for known keys only', () => {
    expect(sanitizeMessages({ 'panel.title': 'Barrierefreiheit', 'not.a.key': 'x', 'panel.close': 7 })).toEqual({ 'panel.title': 'Barrierefreiheit' });
  });

  it('drops a translation that lost or renamed a placeholder, so English shows instead of a raw {name}', () => {
    expect(sanitizeMessages({ 'level.of': 'Stufe {aktuell} von {total}' })).toEqual({});
    expect(sanitizeMessages({ 'level.of': 'Stufe {current}' })).toEqual({});
    expect(sanitizeMessages({ 'level.of': 'Stufe {current} von {total}' })).toEqual({ 'level.of': 'Stufe {current} von {total}' });
  });

  it('accepts nothing from something that is not an object', () => {
    expect(sanitizeMessages(null)).toEqual({});
    expect(sanitizeMessages(['x'])).toEqual({});
    expect(sanitizeMessages('x')).toEqual({});
  });
});

describe('createLocaleLoader', () => {
  const ok = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

  it('has English at once and fetches any other language from the folder next to the script', async () => {
    const fetchImpl = vi.fn(() => ok({ 'panel.title': 'Barrierefreiheit' }));
    const loader = createLocaleLoader('https://cdn.example/widget/locales', fetchImpl);
    expect(loader.get('en')?.['panel.title']).toBe('Accessibility');
    expect(loader.get('de')).toBeUndefined();
    const de = await loader.load('de');
    expect(fetchImpl).toHaveBeenCalledWith('https://cdn.example/widget/locales/de.json');
    expect(de?.['panel.title']).toBe('Barrierefreiheit');
    expect(loader.get('de')).toBe(de);
  });

  it('fetches a language once, however often it is asked for', async () => {
    const fetchImpl = vi.fn(() => ok({}));
    const loader = createLocaleLoader('https://cdn.example/locales/', fetchImpl);
    await Promise.all([loader.load('fr'), loader.load('fr')]);
    await loader.load('fr');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('resolves to null, and asks no more, when the language cannot be had', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }));
    const loader = createLocaleLoader('https://cdn.example/locales/', fetchImpl);
    expect(await loader.load('it')).toBeNull();
    expect(await loader.load('it')).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('asks for nothing without a folder, or for a language it does not ship', async () => {
    const fetchImpl = vi.fn(() => ok({}));
    expect(await createLocaleLoader(null, fetchImpl).load('de')).toBeNull();
    expect(await createLocaleLoader('https://cdn.example/locales/', fetchImpl).load('../../etc/passwd')).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('locale files', () => {
  const codes = LANGUAGES.map((language) => language.code).filter((code) => code !== 'en');

  it('ships a file for every language in the picker', () => {
    const missing = codes.filter((code) => !existsSync(join(LOCALES_DIR, `${code}.json`)));
    expect(missing).toEqual([]);
  });

  it('ships no file the picker does not offer', () => {
    const files = readdirSync(LOCALES_DIR).filter((file) => file.endsWith('.json'));
    const extra = files.map((file) => file.replace(/\.json$/, '')).filter((code) => !codes.includes(code));
    expect(extra).toEqual([]);
  });

  for (const code of codes) {
    it(`${code}: translates every string, with the same placeholders as English`, () => {
      if (!existsSync(join(LOCALES_DIR, `${code}.json`))) return;
      const locale = readLocale(code);
      expect(Object.keys(locale).sort()).toEqual(Object.keys(en).sort());
      for (const key of Object.keys(en) as MessageKey[]) {
        expect(typeof locale[key], `${code} ${key}`).toBe('string');
        expect(locale[key]!.trim(), `${code} ${key}`).not.toBe('');
        expect(placeholders(locale[key]!), `${code} ${key}`).toBe(placeholders(en[key]));
      }
    });
  }

  it('describes the reduce-motion profile without a safety claim, in English and Spanish', () => {
    expect(en['profile.seizureSafe']).toBe('Reduce motion and color');
    const es = readLocale('es');
    for (const locale of [en, es]) {
      for (const label of Object.values(locale)) expect(label).not.toMatch(/safe|segur|seizure|epilep/i);
    }
  });
});
