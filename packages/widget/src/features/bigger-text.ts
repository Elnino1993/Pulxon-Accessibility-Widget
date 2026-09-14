import type { FeatureDefinition } from '../core/registry';
import { pick } from './shared';

const ID = 'bigger-text';

export const TEXT_SCALES = [1.2, 1.4, 1.6, 1.8] as const;

export const SCALABLE_SELECTOR =
  'p,li,dt,dd,td,th,caption,figcaption,blockquote,label,legend,h1,h2,h3,h4,h5,h6,a,button,input,select,' +
  'textarea,span,small,strong,em,b,i,u,summary,pre,code,q,cite,abbr,time,mark,' +
  'div,section,article,header,footer,nav,main,aside,address,figure,details,dl,ul,ol,table,fieldset,form';

interface Original {
  value: string;
  priority: string;
  px: number;
}

interface State {
  scale: number;
  touched: Map<HTMLElement, Original>;
  observer: MutationObserver | null;
}

const STATES = new WeakMap<Document, State>();

function setSize(el: HTMLElement, px: number, scale: number): void {
  el.style.setProperty('font-size', `${Math.round(px * scale * 100) / 100}px`, 'important');
}

function restore(el: HTMLElement, original: Original): void {
  if (original.value) el.style.setProperty('font-size', original.value, original.priority);
  else el.style.removeProperty('font-size');
}

/**
 * Restores and forgets elements that left the document, so a re-inserted element is measured fresh
 * from its original size instead of being scaled again from an already-scaled value. An element only
 * moved within the document (still connected when the callback runs) stays tracked untouched.
 */
function releaseRemoved(state: State, root: Element): void {
  const candidates: Element[] = [];
  if (root.matches(SCALABLE_SELECTOR)) candidates.push(root);
  root.querySelectorAll<HTMLElement>(SCALABLE_SELECTOR).forEach((el) => candidates.push(el));

  for (const el of candidates) {
    const original = state.touched.get(el as HTMLElement);
    if (!original || el.isConnected) continue;
    restore(el as HTMLElement, original);
    state.touched.delete(el as HTMLElement);
  }
}

/**
 * Reads every candidate's computed size first, then writes, to avoid layout thrashing.
 * Known limitation: an element added later inside an already scaled `em`-sized parent is measured
 * after the parent grew, so it scales from the grown size.
 */
function scaleTree(doc: Document, state: State, roots: readonly Element[]): void {
  const win = doc.defaultView;
  if (!win) return;
  const candidates = new Set<HTMLElement>();
  for (const root of roots) {
    if (root.matches(SCALABLE_SELECTOR)) candidates.add(root as HTMLElement);
    root.querySelectorAll<HTMLElement>(SCALABLE_SELECTOR).forEach((el) => candidates.add(el));
  }

  const measured: Array<[HTMLElement, number]> = [];
  for (const el of candidates) {
    if (state.touched.has(el) || el.closest('[data-pulxon-ignore]')) continue;
    const px = Number.parseFloat(win.getComputedStyle(el).fontSize);
    if (Number.isFinite(px) && px > 0) measured.push([el, px]);
  }
  for (const [el, px] of measured) {
    state.touched.set(el, {
      value: el.style.getPropertyValue('font-size'),
      priority: el.style.getPropertyPriority('font-size'),
      px,
    });
    setSize(el, px, state.scale);
  }
}

export const biggerText: FeatureDefinition = {
  id: ID,
  group: 'text',
  labelKey: 'feature.biggerText',
  levels: TEXT_SCALES.length,
  apply: ({ doc }, level) => {
    const scale = pick(TEXT_SCALES, level);
    const existing = STATES.get(doc);
    if (existing) {
      existing.scale = scale;
      existing.touched.forEach((original, el) => {
        if (el.isConnected) setSize(el, original.px, scale);
        else existing.touched.delete(el);
      });
      return;
    }
    const body = doc.body;
    if (!body) return;
    const state: State = { scale, touched: new Map(), observer: null };
    STATES.set(doc, state);
    scaleTree(doc, state, [body]);

    const Observer = doc.defaultView?.MutationObserver;
    if (!Observer) return;
    state.observer = new Observer((records) => {
      for (const record of records) {
        record.removedNodes.forEach((node) => {
          if (node.nodeType === 1) releaseRemoved(state, node as Element);
        });
      }
      const added: Element[] = [];
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.isConnected) added.push(node as Element);
        });
      }
      if (added.length > 0) scaleTree(doc, state, added);
    });
    state.observer.observe(body, { childList: true, subtree: true });
  },
  teardown: ({ doc }) => {
    const state = STATES.get(doc);
    if (!state) return;
    state.observer?.disconnect();
    state.touched.forEach((original, el) => restore(el, original));
    STATES.delete(doc);
  },
};
