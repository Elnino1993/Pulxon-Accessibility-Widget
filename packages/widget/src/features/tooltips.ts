import type { FeatureContext, FeatureDefinition } from '../core/registry';
import { overlayZIndex } from './reading-overlays';

const ID = 'tooltips';
const ATTR = 'data-pulxon-tooltip';
export const GAP_PX = 8;

export function tooltipsCss(zIndex: number): string {
  return (
    `[${ATTR}]{position:absolute!important;z-index:${zIndex}!important;` +
    'background:#111111!important;color:#ffffff!important;border-radius:4px!important;' +
    'padding:6px 8px!important;max-width:280px!important;pointer-events:none!important;' +
    'font-size:13px!important;line-height:1.4!important;box-sizing:border-box!important;' +
    'font-family:system-ui,sans-serif!important}'
  );
}

/** First non-empty, trimmed name found walking up from `target`: `title`, then `aria-label`, then `img[alt]`. */
export function accessibleName(target: Element | null): string | null {
  let el: Element | null = target;
  while (el) {
    const title = el.getAttribute('title');
    if (title && title.trim()) return title.trim();
    const label = el.getAttribute('aria-label');
    if (label && label.trim()) return label.trim();
    if (el.tagName === 'IMG') {
      const alt = el.getAttribute('alt');
      if (alt && alt.trim()) return alt.trim();
    }
    el = el.parentElement;
  }
  return null;
}

interface Rect {
  left: number;
  top: number;
  bottom: number;
}

interface Size {
  width: number;
  height: number;
}

interface Viewport {
  width: number;
  height: number;
}

/**
 * Clamps the tooltip horizontally so it never runs past the viewport's right edge, and
 * flips it above the anchor when there isn't room below — the same plain-number,
 * viewport-aware math `pointer-overlay.ts`'s `place` callbacks use (`Math.max`/`Math.min`
 * against a measured viewport size), just applied to both axes.
 */
export function positionTooltip(anchor: Rect, tip: Size, viewport: Viewport, gap: number): { left: number; top: number } {
  const maxLeft = Math.max(0, viewport.width - tip.width);
  const left = Math.min(Math.max(anchor.left, 0), maxLeft);

  const fitsBelow = anchor.bottom + gap + tip.height <= viewport.height;
  const top = fitsBelow ? anchor.bottom + gap : Math.max(0, anchor.top - gap - tip.height);

  return { left, top };
}

const CLEANUPS = new WeakMap<Document, () => void>();

export const tooltips: FeatureDefinition = {
  id: ID,
  group: 'navigation',
  labelKey: 'feature.tooltips',
  levels: 1,
  apply: (ctx: FeatureContext) => {
    const { doc, styles } = ctx;
    styles.set(ID, tooltipsCss(overlayZIndex(ctx.zIndex)));
    if (CLEANUPS.has(doc) || !doc.body) return;

    const win = doc.defaultView;
    let tip: HTMLDivElement | null = null;

    const hide = (): void => {
      tip?.remove();
      tip = null;
    };

    const show = (target: Element, name: string): void => {
      if (!tip) {
        tip = doc.createElement('div');
        tip.setAttribute(ATTR, '');
        tip.setAttribute('data-pulxon-ignore', '');
        tip.setAttribute('role', 'tooltip');
        tip.setAttribute('aria-hidden', 'true');
        doc.body.appendChild(tip);
      }
      tip.textContent = name;
      const rect = target.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();
      const scrollX = win?.scrollX ?? 0;
      const scrollY = win?.scrollY ?? 0;
      const viewport = { width: win?.innerWidth ?? 0, height: win?.innerHeight ?? 0 };
      const { left, top } = positionTooltip(rect, tipRect, viewport, GAP_PX);
      tip.style.setProperty('left', `${left + scrollX}px`, 'important');
      tip.style.setProperty('top', `${top + scrollY}px`, 'important');
    };

    const nameFor = (event: Event): { target: Element; name: string } | null => {
      const target = event.target as Element | null;
      if (!target || typeof target.closest !== 'function') return null;
      if (target.closest('[data-pulxon-ignore]')) return null;
      const name = accessibleName(target);
      return name ? { target, name } : null;
    };

    const onReveal = (event: Event): void => {
      const found = nameFor(event);
      if (!found) {
        hide();
        return;
      }
      show(found.target, found.name);
    };

    const onHide = (): void => hide();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') hide();
    };

    doc.addEventListener('mouseover', onReveal);
    doc.addEventListener('mouseout', onHide);
    doc.addEventListener('focusin', onReveal);
    doc.addEventListener('focusout', onHide);
    doc.addEventListener('keydown', onKeyDown);
    doc.addEventListener('scroll', onHide, true);

    CLEANUPS.set(doc, () => {
      doc.removeEventListener('mouseover', onReveal);
      doc.removeEventListener('mouseout', onHide);
      doc.removeEventListener('focusin', onReveal);
      doc.removeEventListener('focusout', onHide);
      doc.removeEventListener('keydown', onKeyDown);
      doc.removeEventListener('scroll', onHide, true);
      hide();
    });
  },
  teardown: ({ doc, styles }: FeatureContext) => {
    CLEANUPS.get(doc)?.();
    CLEANUPS.delete(doc);
    styles.remove(ID);
  },
};
