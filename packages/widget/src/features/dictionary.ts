import type { FeatureContext, FeatureDefinition } from '../core/registry';
import { createTranslator, normalizeLanguage } from '../i18n';
import { overlayZIndex } from './reading-overlays';
import { widgetLang } from './shared';
import { positionOverlay } from './tooltips';

const ID = 'dictionary';
const ATTR = 'data-pulxon-dictionary';
const GAP_PX = 8;

// Requires at least one letter so a selection that is only punctuation/marks (e.g. `--`, `'`, or a
// bare combining mark with no base letter) can never pass as a "word" — `'`/`-` remain allowed
// *within* a word (`it's`, `co-op`), just not as the entire content of one.
const WORD = /^(?=.*\p{L})[\p{L}\p{M}'-]{1,40}$/u;

/** The Wiktionary entry for a single selected word, or null when the selection is not one word. */
export function lookupUrl(selection: string, lang: string): string | null {
  const word = selection.trim().replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, '');
  if (!WORD.test(word)) return null;
  const subdomain = normalizeLanguage(lang) ?? 'en';
  return `https://${subdomain}.wiktionary.org/wiki/${encodeURIComponent(word)}`;
}

export function dictionaryCss(zIndex: number): string {
  return (
    `[${ATTR}]{position:absolute!important;z-index:${zIndex}!important;` +
    'background:#111111!important;color:#ffffff!important;border:1px solid #ffffff!important;' +
    'border-radius:4px!important;padding:6px 10px!important;text-decoration:none!important;' +
    'box-sizing:border-box!important;font-size:13px!important;line-height:1.4!important;' +
    'font-family:system-ui,sans-serif!important}' +
    `[${ATTR}]:focus-visible{outline:3px solid #ffbf00!important;outline-offset:2px!important}`
  );
}

/**
 * Like `Element.closest`, but walks out through an open shadow root's host when it runs out of
 * `parentElement`s — `closest` alone stops at the shadow boundary, which would let a selection
 * made inside the widget's own (open) shadow-root panel slip past the `[data-pulxon-ignore]` check.
 */
function closestAcrossShadow(node: Node | null, selector: string): Element | null {
  let el: Element | null = node && node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node?.parentElement ?? null;
  while (el) {
    if (el.matches(selector)) return el;
    const parent = el.parentElement;
    if (parent) {
      el = parent;
      continue;
    }
    const root = el.getRootNode();
    el = root instanceof ShadowRoot ? root.host : null;
  }
  return null;
}

const CLEANUPS = new WeakMap<Document, () => void>();

export const dictionary: FeatureDefinition = {
  id: ID,
  group: 'reading',
  labelKey: 'feature.dictionary',
  levels: 1,
  apply: (ctx: FeatureContext) => {
    const { doc, styles } = ctx;
    styles.set(ID, dictionaryCss(overlayZIndex(ctx.zIndex)));
    if (CLEANUPS.has(doc) || !doc.body) return;

    const win = doc.defaultView;
    let link: HTMLAnchorElement | null = null;

    const hide = (): void => {
      link?.remove();
      link = null;
    };

    const show = (rect: DOMRect, href: string, label: string): void => {
      if (!link) {
        link = doc.createElement('a');
        link.setAttribute(ATTR, '');
        link.setAttribute('data-pulxon-ignore', '');
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        // A `mousedown` on the link is the browser's cue to move the caret (and so collapse the
        // active selection) to wherever the pointer went down — the same default action it would
        // take on any other click outside the current selection. Left alone, that collapse (via
        // `onSelectionChange` below) could remove the link before the `click` that follows it ever
        // gets a chance to fire. `preventDefault()` here stops only that default caret-move action;
        // it does not stop the click, and every other way the selection collapses (the visitor
        // clicking elsewhere, pressing an arrow key, and so on) still hides the link as before.
        link.addEventListener('mousedown', (event) => event.preventDefault());
        doc.body.appendChild(link);
      }
      link.textContent = label;
      link.setAttribute('href', href);
      const scrollX = win?.scrollX ?? 0;
      const scrollY = win?.scrollY ?? 0;
      const linkRect = link.getBoundingClientRect();
      const viewport = { width: win?.innerWidth ?? 0, height: win?.innerHeight ?? 0 };
      const { left, top } = positionOverlay(rect, linkRect, viewport, GAP_PX);
      link.style.setProperty('left', `${left + scrollX}px`, 'important');
      link.style.setProperty('top', `${top + scrollY}px`, 'important');
    };

    const onSelectionChange = (): void => {
      const selection = doc.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        hide();
        return;
      }
      // A selection the visitor made inside the widget's own (open) shadow-root panel must never
      // offer a lookup for it; `closestAcrossShadow` is required here because a plain `closest()`
      // call on `selection.anchorNode` cannot walk out past the shadow root to the ignored host.
      if (closestAcrossShadow(selection.anchorNode, '[data-pulxon-ignore]')) {
        hide();
        return;
      }
      const lang = widgetLang(doc);
      const href = lookupUrl(selection.toString(), lang);
      if (!href) {
        hide();
        return;
      }
      const range = selection.getRangeAt(0);
      show(range.getBoundingClientRect(), href, createTranslator(lang)('feature.dictionaryLookup'));
    };

    doc.addEventListener('selectionchange', onSelectionChange);

    CLEANUPS.set(doc, () => {
      doc.removeEventListener('selectionchange', onSelectionChange);
      hide();
    });
  },
  teardown: ({ doc, styles }: FeatureContext) => {
    CLEANUPS.get(doc)?.();
    CLEANUPS.delete(doc);
    styles.remove(ID);
  },
};
