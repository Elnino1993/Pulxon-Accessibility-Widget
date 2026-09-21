import { LANGUAGES, matchLanguage } from './languages';
import { en } from './locales/en';

export { LANGUAGES, isRtl } from './languages';
export type { Language } from './languages';

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
/** A loaded locale: whatever of the English keys it translates. The rest falls back to English. */
export type PartialMessages = Partial<Messages>;
export type Translator = (key: MessageKey, vars?: Record<string, string | number>) => string;

export const SUPPORTED_LANGUAGES: string[] = LANGUAGES.map((language) => language.code);

export function normalizeLanguage(tag: string | null | undefined): string | null {
  return matchLanguage(tag);
}

export function resolveLanguage(
  preferred: string | null,
  doc: Document,
  nav?: { languages?: readonly string[]; language?: string },
): string {
  const candidates = [
    preferred,
    doc.documentElement.getAttribute('lang'),
    ...(nav?.languages ?? []),
    nav?.language,
  ];
  for (const candidate of candidates) {
    const lang = normalizeLanguage(candidate);
    if (lang) return lang;
  }
  return 'en';
}

/**
 * Resolves the language the panel should render in right now: the visitor's own stored choice
 * (`settings.lang`) when they made one, normalized to a language this widget ships, otherwise the
 * language the widget was mounted with. Shared by `mount.tsx` (DOM attributes) and `App.tsx` (the
 * translator) so both stay in lockstep when the visitor changes language from the panel.
 */
export function resolveStoredLanguage(storedLang: string | null, fallback: string): string {
  if (!storedLang) return fallback;
  return normalizeLanguage(storedLang) ?? fallback;
}

const PLACEHOLDER = /\{(\w+)\}/g;

function placeholders(template: string): string {
  return [...template.matchAll(PLACEHOLDER)]
    .map((match) => match[1])
    .sort()
    .join(',');
}

/**
 * Keeps only what a locale file may safely contribute: strings for keys English has, with the same
 * `{placeholders}`. A translation that dropped or renamed one would print a raw `{name}` or lose the
 * value, so that one string falls back to English instead of the whole language failing.
 */
export function sanitizeMessages(raw: unknown): PartialMessages {
  const out: PartialMessages = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const key of Object.keys(en) as MessageKey[]) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim() && placeholders(value) === placeholders(en[key])) out[key] = value;
  }
  return out;
}

export function createTranslator(lang: string, messages?: PartialMessages): Translator {
  const table: PartialMessages = lang === 'en' || !messages ? en : messages;
  return (key, vars) => {
    const template = table[key] ?? en[key];
    if (!vars) return template;
    return template.replace(PLACEHOLDER, (match, name: string) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
    );
  };
}

export interface LocaleLoader {
  /** The messages for `code` if they are already here (English always is), else undefined. */
  get(code: string): PartialMessages | undefined;
  /** Fetches `code` once; resolves to null when it cannot be had, so the panel stays in English. */
  load(code: string): Promise<PartialMessages | null>;
}

/**
 * Loads `locales/<code>.json` from `baseUrl` — the folder next to the script, like the fonts. A
 * language is fetched at most once per page; a failed fetch is remembered too, so a site that does
 * not host the locales is not asked again on every render.
 */
export function createLocaleLoader(
  baseUrl: string | null,
  fetchImpl: ((url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>) | null = typeof fetch === 'function'
    ? (url) => fetch(url, { credentials: 'omit' })
    : null,
): LocaleLoader {
  const loaded = new Map<string, PartialMessages>([['en', en]]);
  const pending = new Map<string, Promise<PartialMessages | null>>();
  const base = baseUrl ? (baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`) : null;

  return {
    get: (code) => loaded.get(code),
    load: (code) => {
      const known = loaded.get(code);
      if (known) return Promise.resolve(known);
      const inFlight = pending.get(code);
      if (inFlight) return inFlight;
      if (!base || !fetchImpl || !SUPPORTED_LANGUAGES.includes(code)) return Promise.resolve(null);
      const request = fetchImpl(`${base}${code}.json`)
        .then(async (response) => {
          if (!response.ok) return null;
          const messages = sanitizeMessages(await response.json());
          loaded.set(code, messages);
          return messages;
        })
        .catch(() => null);
      pending.set(code, request);
      return request;
    },
  };
}

