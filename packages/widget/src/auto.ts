import type { PulxonApi } from './api';
import { DEFAULT_API_BASE, parseDataAttributes, type WidgetOptions } from './config/options';
import { fetchRemoteConfig } from './config/remote-config';
import { createWidget } from './create-widget';

declare global {
  interface Window {
    Pulxon?: PulxonApi;
  }
}

const BOT_PATTERN = /bot|crawler|spider|crawling/i;
const LOADED_ATTR = 'data-pulxon-loaded';

function boot(doc: Document): void {
  const win = doc.defaultView;
  if (!win || win.Pulxon || doc.documentElement.hasAttribute(LOADED_ATTR)) return;
  if (BOT_PATTERN.test(win.navigator.userAgent)) return;

  const script = doc.currentScript as HTMLScriptElement | null;
  const options = parseDataAttributes(script);
  if (!options.nonce && script?.nonce) options.nonce = script.nonce;
  if (!options.fontBaseUrl && script?.src) {
    try {
      options.fontBaseUrl = new URL('fonts/', script.src).href;
    } catch {
      // Invalid script URL: the dyslexia font falls back to locally installed fonts.
    }
  }
  // The panel's languages sit next to the script too, like the fonts.
  if (!options.localeBaseUrl && script?.src) {
    try {
      options.localeBaseUrl = new URL('locales/', script.src).href;
    } catch {
      // Invalid script URL: the panel stays in English.
    }
  }
  doc.documentElement.setAttribute(LOADED_ATTR, '');

  const start = (remote: Partial<WidgetOptions>): void => {
    try {
      // With a site key, the dashboard config decides branding, so it must not be overridden locally.
      const localOptions: Partial<WidgetOptions> = { ...options };
      if (localOptions.siteKey) delete localOptions.branding;
      const api = createWidget({
        // Explicit data attributes win over the dashboard config, except branding above.
        options: { ...remote, ...localOptions },
        document: doc,
        onDestroy: () => {
          if (win.Pulxon === api) delete win.Pulxon;
          doc.documentElement.removeAttribute(LOADED_ATTR);
        },
      });
      win.Pulxon = api;
      doc.dispatchEvent(new win.CustomEvent('pulxon:ready', { detail: api }));
    } catch (error) {
      doc.documentElement.removeAttribute(LOADED_ATTR);
      console.error('[pulxon] failed to start', error);
    }
  };

  // Start the config request right away; create the widget once the DOM is ready and the request settled.
  const remote = options.siteKey
    ? fetchRemoteConfig({ siteKey: options.siteKey, apiBase: options.apiBase ?? DEFAULT_API_BASE })
    : Promise.resolve(null);
  const ready = new Promise<void>((resolve) => {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    else resolve();
  });
  void Promise.all([remote, ready]).then(([config]) => start(config ?? {}));
}

boot(document);
