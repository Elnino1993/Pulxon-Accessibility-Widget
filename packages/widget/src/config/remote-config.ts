import {
  LAUNCHER_ICONS,
  isFeatureIdList,
  isHttpUrl,
  isLang,
  isOffset,
  isPosition,
  type Position,
  type WidgetOptions,
} from './options';

export const REMOTE_CONFIG_VERSION = 1;
export const REMOTE_CONFIG_TIMEOUT_MS = 3000;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
const SITE_KEY = /^pk_(?:live|test)_[A-Za-z0-9]{8,64}$/;

export type RemoteWidgetOptions = Partial<
  Pick<
    WidgetOptions,
    'position' | 'mobilePosition' | 'offsetX' | 'offsetY' | 'color' | 'size' | 'icon' | 'lang' | 'hideOnMobile' | 'disabledFeatures' | 'branding'
  >
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates the dashboard's config JSON. Unknown or invalid fields are dropped; an unknown shape returns null. */
export function parseRemoteConfig(value: unknown): RemoteWidgetOptions | null {
  if (!isRecord(value) || value.version !== REMOTE_CONFIG_VERSION || !isRecord(value.widget)) return null;
  const widget = value.widget;
  const out: RemoteWidgetOptions = {};
  if (isPosition(widget.position)) out.position = widget.position;
  if (widget.mobilePosition === null || isPosition(widget.mobilePosition)) out.mobilePosition = widget.mobilePosition as Position | null;
  if (isOffset(widget.offsetX)) out.offsetX = widget.offsetX;
  if (isOffset(widget.offsetY)) out.offsetY = widget.offsetY;
  if (typeof widget.color === 'string' && HEX_COLOR.test(widget.color)) out.color = widget.color;
  if (widget.size === 'small' || widget.size === 'medium' || widget.size === 'large') out.size = widget.size;
  if (typeof widget.icon === 'string' && (LAUNCHER_ICONS as readonly string[]).includes(widget.icon)) {
    out.icon = widget.icon as RemoteWidgetOptions['icon'];
  }
  if (widget.lang === null || isLang(widget.lang)) out.lang = widget.lang as string | null;
  if (typeof widget.hideOnMobile === 'boolean') out.hideOnMobile = widget.hideOnMobile;
  if (isFeatureIdList(widget.disabledFeatures)) out.disabledFeatures = [...widget.disabledFeatures];
  if (typeof widget.branding === 'boolean') out.branding = widget.branding;
  return out;
}

export function remoteConfigUrl(siteKey: string, apiBase: string): string | null {
  if (!SITE_KEY.test(siteKey) || !isHttpUrl(apiBase)) return null;
  const base = apiBase.endsWith('/') ? apiBase : `${apiBase}/`;
  return new URL(`v1/sites/${siteKey}/config`, base).href;
}

export interface FetchRemoteConfigInput {
  siteKey: string;
  apiBase: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** Never rejects: any failure resolves to null so the widget starts with its local options. */
export async function fetchRemoteConfig(input: FetchRemoteConfigInput): Promise<RemoteWidgetOptions | null> {
  const fetchImpl = input.fetch ?? (typeof fetch === 'function' ? fetch : undefined);
  const url = remoteConfigUrl(input.siteKey, input.apiBase);
  if (!fetchImpl || !url) return null;

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller?.abort();
      resolve(null);
    }, input.timeoutMs ?? REMOTE_CONFIG_TIMEOUT_MS);
  });

  const request = (async (): Promise<RemoteWidgetOptions | null> => {
    try {
      const response = await fetchImpl(url, { method: 'GET', mode: 'cors', credentials: 'omit', signal: controller?.signal });
      if (!response.ok) return null;
      return parseRemoteConfig(await response.json());
    } catch {
      return null;
    }
  })();

  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
