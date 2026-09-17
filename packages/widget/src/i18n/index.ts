import { en } from './locales/en';
import { es } from './locales/es';

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
export type Translator = (key: MessageKey, vars?: Record<string, string | number>) => string;

const CATALOG: Record<string, Messages> = { en, es };

export const SUPPORTED_LANGUAGES: string[] = Object.keys(CATALOG);

export function normalizeLanguage(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const base = tag.trim().toLowerCase().split(/[-_]/)[0];
  return base && Object.prototype.hasOwnProperty.call(CATALOG, base) ? base : null;
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

export function createTranslator(lang: string): Translator {
  const messages = CATALOG[lang] ?? en;
  return (key, vars) => {
    const template = messages[key] ?? en[key];
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
    );
  };
}
