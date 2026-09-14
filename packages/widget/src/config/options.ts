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
};

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
const SITE_KEY = /^pk_(?:live|test)_[A-Za-z0-9]{8,64}$/;

function isPosition(value: string): value is Position {
  return (POSITIONS as readonly string[]).includes(value);
}

export function parseDataAttributes(el: HTMLElement | null): Partial<WidgetOptions> {
  if (!el) return {};
  const data = el.dataset;
  const out: Partial<WidgetOptions> = {};

  if (data.position && isPosition(data.position)) out.position = data.position;
  if (data.offset) {
    const [x, y] = data.offset.split(',').map((part) => Number.parseInt(part.trim(), 10));
    if (x !== undefined && Number.isFinite(x)) out.offsetX = x;
    if (y !== undefined && Number.isFinite(y)) out.offsetY = y;
  }
  if (data.color && HEX_COLOR.test(data.color)) out.color = data.color;
  if (data.size === 'small' || data.size === 'medium' || data.size === 'large') out.size = data.size;
  if (data.lang) out.lang = data.lang;
  if (data.hideOnMobile !== undefined) out.hideOnMobile = data.hideOnMobile === 'true';
  if (data.trigger) out.trigger = data.trigger;
  if (data.nonce) out.nonce = data.nonce;
  if (data.siteKey && SITE_KEY.test(data.siteKey)) out.siteKey = data.siteKey;
  if (data.zIndex) {
    const z = Number.parseInt(data.zIndex, 10);
    if (Number.isFinite(z)) out.zIndex = z;
  }
  return out;
}

function isValidOption(key: string, value: unknown): boolean {
  if (key === 'color') return typeof value === 'string' && HEX_COLOR.test(value);
  if (key === 'position') return typeof value === 'string' && isPosition(value);
  if (key === 'size') return value === 'small' || value === 'medium' || value === 'large';
  if (key === 'fontBaseUrl') return value === null || typeof value === 'string';
  return true;
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
