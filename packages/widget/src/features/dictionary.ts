import type { FeatureContext, FeatureDefinition } from '../core/registry';
import { createTranslator, normalizeLanguage } from '../i18n';
import { overlayZIndex } from './reading-overlays';
import { widgetLang } from './shared';
import { positionOverlay } from './tooltips';

const ID = 'dictionary';
const ATTR = 'data-pulxon-dictionary';
const NEW_TAB_ATTR = 'data-pulxon-dictionary-newtab';
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
    `[${ATTR}]:focus-visible{outline:3px solid #ffbf00!important;outline-offset:2px!important}` +
    // The " (opens in a new tab)" suffix (see NEW_TAB_ATTR below) is for screen readers only — same
    // visually-hidden technique as the panel's own `.sr-only` class (styles.css), reimplemented here
    // because this link lives in the host page, outside the widget's shadow root that class is scoped to.
    `[${ATTR}] [${NEW_TAB_ATTR}]{position:absolute!important;width:1px!important;height:1px!important;` +
    'padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;' +
    'white-space:nowrap!important;border:0!important}'
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

/**
 * The nearest element containing `node` — `node` itself when it is already an element, otherwise its
 * parent. Used to find where the selection's end sits in the document, so the lookup link can be
 * inserted right after it: a keyboard visitor who just selected text there with Shift+Arrow and
 * presses Tab lands on the link immediately, instead of having to traverse the rest of the page to
 * reach it at the end of `<body>`.
 */
function insertionAnchor(node: Node | null): Element | null {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
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

    const show = (rect: DOMRect, href: string, label: string, newTabSuffix: string, anchor: Element | null): void => {
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
      }
      link.textContent = label;
      const newTab = doc.createElement('span');
      newTab.setAttribute(NEW_TAB_ATTR, '');
      newTab.textContent = ` ${newTabSuffix}`;
      link.appendChild(newTab);
      link.setAttribute('href', href);
      // Placed right after the element containing the selection's end, so it sits in the tab order
      // exactly where the visitor already is, and moved there again on every show in case the
      // visitor selected a word somewhere else on the page since the link was last shown.
      if (anchor?.parentNode) {
        anchor.insertAdjacentElement('afterend', link);
      } else if (!link.isConnected) {
        doc.body.appendChild(link);
      }
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
      const t = ctx.getTranslator?.() ?? createTranslator(lang);
      show(range.getBoundingClientRect(), href, t('feature.dictionaryLookup'), t('link.newTab'), insertionAnchor(range.endContainer));
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
