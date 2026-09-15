export type Position =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export const POSITIONS: readonly Position[] = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export type LauncherIcon = 'person' | 'eye' | 'contrast';
export const LAUNCHER_ICONS: readonly LauncherIcon[] = ['person', 'eye', 'contrast'];
export const DEFAULT_API_BASE = 'https://api.pulxon.com';
const MAX_DISABLED_FEATURES = 30;
const MAX_OFFSET = 200;

export interface WidgetOptions {
  position: Position;
  offsetX: number;
  offsetY: number;
  color: string;
  size: 'small' | 'medium' | 'large';
  lang: string | null;
  hideOnMobile: boolean;
  trigger: string | null;
  nonce: string | null;
  siteKey: string | null;
  zIndex: number;
  fontBaseUrl: string | null;
  mobilePosition: Position | null;
  icon: LauncherIcon;
  disabledFeatures: string[];
  branding: boolean;
  apiBase: string;
}

export const DEFAULT_OPTIONS: WidgetOptions = {
  position: 'bottom-right',
  offsetX: 20,
  offsetY: 20,
  color: '#1f4bff',
  size: 'medium',
  lang: null,
  hideOnMobile: false,
  trigger: null,
  nonce: null,
  siteKey: null,
  zIndex: 2147483000,
  fontBaseUrl: null,
  mobilePosition: null,
  icon: 'person',
  disabledFeatures: [],
  branding: true,
  apiBase: DEFAULT_API_BASE,
};

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
const SITE_KEY = /^pk_(?:live|test)_[A-Za-z0-9]{8,64}$/;
const FEATURE_ID = /^[a-z][a-z0-9-]{0,39}$/;
const LANG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/;

export function isPosition(value: unknown): value is Position {
  return typeof value === 'string' && (POSITIONS as readonly string[]).includes(value);
}

/** Shared with `remote-config.ts` so the dashboard config and data attributes accept the same colors. */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

/** Shared with `remote-config.ts` so the dashboard config and data attributes accept the same site keys. */
export function isSiteKey(value: unknown): value is string {
  return typeof value === 'string' && SITE_KEY.test(value);
}

function isIcon(value: unknown): value is LauncherIcon {
  return typeof value === 'string' && (LAUNCHER_ICONS as readonly string[]).includes(value);
}

export function isOffset(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_OFFSET;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function parseFeatureList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => FEATURE_ID.test(part))
    .slice(0, MAX_DISABLED_FEATURES);
}

export function isFeatureIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_DISABLED_FEATURES && value.every((item) => typeof item === 'string' && FEATURE_ID.test(item));
}

export function isLang(value: unknown): value is string {
  return typeof value === 'string' && LANG.test(value);
}

/**
 * Normalizes common but non-canonical `data-lang` spellings (`ES`, `es_MX`, `pt_br`) into the
 * BCP 47-like shape `isLang` expects, before validating. Remote config values stay strict.
 */
function normalizeLangTag(value: string): string {
  return value
    .trim()
    .replace(/_/g, '-')
    .split('-')
    .map((part, index) => {
      if (index === 0) return part.toLowerCase();
      return /^[A-Za-z]{2}$/.test(part) ? part.toUpperCase() : part;
    })
    .join('-');
}

export function parseDataAttributes(el: HTMLElement | null): Partial<WidgetOptions> {
  if (!el) return {};
  const data = el.dataset;
  const out: Partial<WidgetOptions> = {};

  if (data.position && isPosition(data.position)) out.position = data.position;
  if (data.offset) {
    const [x, y] = data.offset.split(',').map((part) => Number.parseInt(part.trim(), 10));
    if (x !== undefined && isOffset(x)) out.offsetX = x;
    if (y !== undefined && isOffset(y)) out.offsetY = y;
  }
  if (data.color && HEX_COLOR.test(data.color)) out.color = data.color;
  if (data.size === 'small' || data.size === 'medium' || data.size === 'large') out.size = data.size;
  if (data.lang) {
    const normalizedLang = normalizeLangTag(data.lang);
    if (isLang(normalizedLang)) out.lang = normalizedLang;
  }
  if (data.hideOnMobile !== undefined) out.hideOnMobile = data.hideOnMobile === 'true';
  if (data.trigger) out.trigger = data.trigger;
  if (data.nonce) out.nonce = data.nonce;
  if (data.siteKey && SITE_KEY.test(data.siteKey)) out.siteKey = data.siteKey;
  if (data.zIndex) {
    const z = Number.parseInt(data.zIndex, 10);
    if (Number.isFinite(z)) out.zIndex = z;
  }
  if (data.mobilePosition && isPosition(data.mobilePosition)) out.mobilePosition = data.mobilePosition;
  if (data.icon && isIcon(data.icon)) out.icon = data.icon;
  if (data.disabledFeatures !== undefined) out.disabledFeatures = parseFeatureList(data.disabledFeatures);
  if (data.branding !== undefined) out.branding = data.branding !== 'false';
  if (data.api && isHttpUrl(data.api)) out.apiBase = data.api;
  return out;
}

function isValidOption(key: string, value: unknown): boolean {
  switch (key) {
    case 'color':
      return typeof value === 'string' && HEX_COLOR.test(value);
    case 'position':
      return typeof value === 'string' && isPosition(value);
    case 'mobilePosition':
      return value === null || (typeof value === 'string' && isPosition(value));
    case 'size':
      return value === 'small' || value === 'medium' || value === 'large';
    case 'icon':
      return isIcon(value);
    case 'offsetX':
    case 'offsetY':
      return isOffset(value);
    case 'lang':
      return value === null || isLang(value);
    case 'hideOnMobile':
    case 'branding':
      return typeof value === 'boolean';
    case 'disabledFeatures':
      return isFeatureIdList(value);
    case 'apiBase':
      return typeof value === 'string' && isHttpUrl(value);
    case 'fontBaseUrl':
      return value === null || typeof value === 'string';
    default:
      return true;
  }
}

export function resolveOptions(...parts: Array<Partial<WidgetOptions>>): WidgetOptions {
  const result: WidgetOptions = { ...DEFAULT_OPTIONS };
  const target = result as unknown as Record<string, unknown>;
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      if (value !== undefined && isValidOption(key, value)) target[key] = value;
    }
  }
  return result;
}
