/**
 * The languages the panel ships, in Sienna Accessibility Widget's set (MIT, see
 * THIRD_PARTY_NOTICES.txt). English is bundled; every other language is `locales/<code>.json` next
 * to the script, loaded the first time it is used.
 *
 * `label` is the language's own name, then its English name, so a visitor finds their language
 * whatever language the panel is in right now. Sienna's list has a few slips, fixed here: Danish was
 * "Danish (Denmark)", Filipino was "Tagalog (Filipno)".
 */
export interface Language {
  code: string;
  label: string;
  /** Written right to left: the panel is laid out mirrored. */
  rtl?: true;
}

export const LANGUAGES: readonly Language[] = [
  { code: 'am', label: 'አማርኛ (Amharic)' },
  { code: 'ar', label: 'العربية (Arabic)', rtl: true },
  { code: 'bg', label: 'Български (Bulgarian)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
  { code: 'ca', label: 'Català (Catalan)' },
  { code: 'cs', label: 'Čeština (Czech)' },
  { code: 'da', label: 'Dansk (Danish)' },
  { code: 'de', label: 'Deutsch (German)' },
  { code: 'el', label: 'Ελληνικά (Greek)' },
  { code: 'en', label: 'English (English)' },
  { code: 'es', label: 'Español (Spanish)' },
  { code: 'fa', label: 'فارسی (Persian)', rtl: true },
  { code: 'fi', label: 'Suomi (Finnish)' },
  { code: 'fil', label: 'Filipino (Filipino)' },
  { code: 'fr', label: 'Français (French)' },
  { code: 'he', label: 'עברית (Hebrew)', rtl: true },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'hr', label: 'Hrvatski (Croatian)' },
  { code: 'hu', label: 'Magyar (Hungarian)' },
  { code: 'id', label: 'Bahasa Indonesia (Indonesian)' },
  { code: 'it', label: 'Italiano (Italian)' },
  { code: 'ja', label: '日本語 (Japanese)' },
  { code: 'ka', label: 'ქართული (Georgian)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ko', label: '한국어 (Korean)' },
  { code: 'ku', label: 'Kurdî (Kurdish)' },
  { code: 'lb', label: 'Lëtzebuergesch (Luxembourgish)' },
  { code: 'ml', label: 'മലയാളം (Malayalam)' },
  { code: 'mn', label: 'Монгол (Mongolian)' },
  { code: 'ms', label: 'Bahasa Melayu (Malay)' },
  { code: 'my', label: 'မြန်မာ (Burmese)' },
  { code: 'nl', label: 'Nederlands (Dutch)' },
  { code: 'no', label: 'Norsk (Norwegian)' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'pl', label: 'Polski (Polish)' },
  { code: 'pt', label: 'Português (Portuguese)' },
  { code: 'ro', label: 'Română (Romanian)' },
  { code: 'ru', label: 'Русский (Russian)' },
  { code: 'si', label: 'සිංහල (Sinhala)' },
  { code: 'sk', label: 'Slovenčina (Slovak)' },
  { code: 'sl', label: 'Slovenščina (Slovenian)' },
  { code: 'sr', label: 'Srpski (Serbian)' },
  { code: 'sr-SP', label: 'Српски (Serbian Cyrillic)' },
  { code: 'sv', label: 'Svenska (Swedish)' },
  { code: 'sw', label: 'Kiswahili (Swahili)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'th', label: 'ไทย (Thai)' },
  { code: 'tr', label: 'Türkçe (Turkish)' },
  { code: 'ur', label: 'اردو (Urdu)', rtl: true },
  { code: 'vi', label: 'Tiếng Việt (Vietnamese)' },
  { code: 'zh-Hans', label: '简体中文 (Simplified Chinese)' },
  { code: 'zh-Hant', label: '繁體中文 (Traditional Chinese)' },
];

/** Tags a page or browser commonly uses for a language this list names differently. */
const ALIASES: Record<string, string> = {
  zh: 'zh-Hans',
  'zh-cn': 'zh-Hans',
  'zh-sg': 'zh-Hans',
  'zh-hans': 'zh-Hans',
  'zh-tw': 'zh-Hant',
  'zh-hk': 'zh-Hant',
  'zh-mo': 'zh-Hant',
  'zh-hant': 'zh-Hant',
  'sr-cyrl': 'sr-SP',
  'sr-sp': 'sr-SP',
  'sr-latn': 'sr',
  nb: 'no',
  nn: 'no',
  tl: 'fil',
  iw: 'he',
  in: 'id',
};

const BY_CODE = new Map(LANGUAGES.map((language) => [language.code.toLowerCase(), language.code]));

/**
 * The shipped language a tag like `pt-BR`, `zh_TW` or `EN` means, or null. The full tag is tried
 * first (so `zh-TW` is Traditional, not just "Chinese"), then its script subtag, then its base.
 */
export function matchLanguage(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const parts = tag.trim().toLowerCase().replace(/_/g, '-').split('-').filter(Boolean);
  if (parts.length === 0) return null;
  const candidates = [parts.join('-'), parts.slice(0, 2).join('-'), parts[0]!];
  for (const candidate of candidates) {
    const direct = ALIASES[candidate] ?? BY_CODE.get(candidate);
    if (direct) return direct;
  }
  return null;
}

export function isRtl(code: string): boolean {
  return LANGUAGES.some((language) => language.code === code && language.rtl);
}
