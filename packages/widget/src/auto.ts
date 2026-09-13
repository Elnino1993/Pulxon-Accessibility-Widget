import type { PulxonApi } from './api';
import { parseDataAttributes } from './config/options';
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
  doc.documentElement.setAttribute(LOADED_ATTR, '');

  const start = (): void => {
    try {
      const api = createWidget({
        options,
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

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

boot(document);
