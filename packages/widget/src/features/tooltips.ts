import type { FeatureContext, FeatureDefinition } from '../core/registry';
import { overlayZIndex } from './reading-overlays';

const ID = 'tooltips';
const ATTR = 'data-pulxon-tooltip';
export const GAP_PX = 8;

export function tooltipsCss(zIndex: number): string {
  return (
    `[${ATTR}]{position:absolute!important;z-index:${zIndex}!important;` +
    'background:#111111!important;color:#ffffff!important;border-radius:4px!important;' +
    'padding:6px 8px!important;max-width:280px!important;' +
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
 * Clamps a viewport-anchored overlay (a tooltip bubble, the dictionary lookup link, ...) so it
 * never runs past the viewport's right edge, and flips it above the anchor when there isn't room
 * below — the same plain-number, viewport-aware math `pointer-overlay.ts`'s `place` callbacks use
 * (`Math.max`/`Math.min` against a measured viewport size), just applied to both axes.
 *
 * Shared by `tooltips.ts` and `dictionary.ts`: both position a small absolutely-positioned element
 * relative to an anchor rect and must keep it fully on screen, so this is one implementation with
 * two callers rather than two near-identical copies of the same clamp.
 */
export function positionOverlay(anchor: Rect, size: Size, viewport: Viewport, gap: number): { left: number; top: number } {
  const maxLeft = Math.max(0, viewport.width - size.width);
  const left = Math.min(Math.max(anchor.left, 0), maxLeft);

  const fitsBelow = anchor.bottom + gap + size.height <= viewport.height;
  const top = fitsBelow ? anchor.bottom + gap : Math.max(0, anchor.top - gap - size.height);

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
    // The element the currently-shown tooltip describes. Needed by `onMouseOut` to tell "the pointer
    // crossed the gap onto the tooltip bubble" (keep it shown — WCAG 1.4.13 "hoverable") apart from
    // "the pointer left the hovered element for good" (hide it).
    let shownFor: Element | null = null;

    const hide = (): void => {
      tip?.remove();
      tip = null;
      shownFor = null;
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
      shownFor = target;
      tip.textContent = name;
      const rect = target.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();
      const scrollX = win?.scrollX ?? 0;
      const scrollY = win?.scrollY ?? 0;
      const viewport = { width: win?.innerWidth ?? 0, height: win?.innerHeight ?? 0 };
      const { left, top } = positionOverlay(rect, tipRect, viewport, GAP_PX);
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

    // The tooltip bubble itself carries `data-pulxon-ignore` (so it can never re-trigger its own name
    // lookup), which would otherwise make `nameFor` treat the pointer entering it as "no name here,
    // hide" — exactly backwards for a bubble the visitor is now hovering. Moving onto the bubble is a
    // no-op: it is already shown, and its own content never changes what it displays.
    const onReveal = (event: Event): void => {
      const target = event.target as Element | null;
      if (tip && target && (target === tip || tip.contains(target))) return;
      const found = nameFor(event);
      if (!found) {
        hide();
        return;
      }
      show(found.target, found.name);
    };

    // WCAG 1.4.13 "hoverable": a visitor with low vision or a tremor must be able to move the pointer
    // off the hovered element and onto the tooltip bubble (crossing the gap between them) without it
    // disappearing. `mouseout` fires as the pointer leaves an element; `relatedTarget` is where it
    // went. Only hide when that destination is neither inside the element the tooltip describes nor
    // inside the tooltip itself — i.e. the pointer actually left both.
    const onMouseOut = (event: MouseEvent): void => {
      const related = event.relatedTarget as Node | null;
      if (related && shownFor && (shownFor === related || shownFor.contains(related))) return;
      if (related && tip && (tip === related || tip.contains(related))) return;
      hide();
    };

    const onFocusOut = (): void => hide();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') hide();
    };

    doc.addEventListener('mouseover', onReveal);
    doc.addEventListener('mouseout', onMouseOut);
    doc.addEventListener('focusin', onReveal);
    doc.addEventListener('focusout', onFocusOut);
    doc.addEventListener('keydown', onKeyDown);
    doc.addEventListener('scroll', hide, true);

    CLEANUPS.set(doc, () => {
      doc.removeEventListener('mouseover', onReveal);
      doc.removeEventListener('mouseout', onMouseOut);
      doc.removeEventListener('focusin', onReveal);
      doc.removeEventListener('focusout', onFocusOut);
      doc.removeEventListener('keydown', onKeyDown);
      doc.removeEventListener('scroll', hide, true);
      hide();
    });
  },
  teardown: ({ doc, styles }: FeatureContext) => {
    CLEANUPS.get(doc)?.();
    CLEANUPS.delete(doc);
    styles.remove(ID);
  },
};
