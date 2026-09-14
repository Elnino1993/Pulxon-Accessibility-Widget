import type { FeatureContext, FeatureDefinition } from '../core/registry';
import type { MessageKey } from '../i18n';
import { createPointerOverlay, type OverlayPlacement } from './pointer-overlay';

export const MASK_BAND_PX = 120;
export const GUIDE_OFFSET_PX = 14;

/** Just below the default widget z-index so the launcher and panel stay on top. */
const OVERLAY_Z_INDEX = 2147482999;

const OVERLAY_BASE =
  `position:fixed!important;left:0!important;right:0!important;margin:0!important;padding:0!important;` +
  `z-index:${OVERLAY_Z_INDEX}!important;pointer-events:none!important`;

export const READING_MASK_CSS =
  `.pulxon-reading-mask{${OVERLAY_BASE};border:0!important;background:rgba(0,0,0,0.6)!important}` +
  '.pulxon-reading-mask--top{top:0!important}' +
  '.pulxon-reading-mask--bottom{bottom:0!important}';

export const READING_GUIDE_CSS =
  `.pulxon-reading-guide{${OVERLAY_BASE};height:12px!important;background:rgba(31,75,255,0.3)!important;` +
  'border:0!important;border-top:2px solid #1f4bff!important;border-bottom:2px solid #1f4bff!important}';

interface OverlayFeatureInput {
  id: string;
  labelKey: MessageKey;
  css: string;
  classNames: readonly string[];
  place: OverlayPlacement;
  conflictsWith?: string[];
}

function overlayFeature(input: OverlayFeatureInput): FeatureDefinition {
  const cleanups = new WeakMap<Document, () => void>();
  return {
    id: input.id,
    group: 'reading',
    labelKey: input.labelKey,
    levels: 1,
    conflictsWith: input.conflictsWith,
    apply: ({ doc, styles }: FeatureContext) => {
      styles.set(input.id, input.css);
      if (cleanups.has(doc) || !doc.body) return;
      cleanups.set(doc, createPointerOverlay(doc, input.classNames, input.place));
    },
    teardown: ({ doc, styles }: FeatureContext) => {
      cleanups.get(doc)?.();
      cleanups.delete(doc);
      styles.remove(input.id);
    },
  };
}

export const readingMask = overlayFeature({
  id: 'reading-mask',
  labelKey: 'feature.readingMask',
  css: READING_MASK_CSS,
  classNames: ['pulxon-reading-mask pulxon-reading-mask--top', 'pulxon-reading-mask pulxon-reading-mask--bottom'],
  place: ([top, bottom], pointerY) => {
    const half = MASK_BAND_PX / 2;
    top?.style.setProperty('height', `${Math.max(0, pointerY - half)}px`, 'important');
    bottom?.style.setProperty('top', `${pointerY + half}px`, 'important');
  },
});

export const readingGuide = overlayFeature({
  id: 'reading-guide',
  labelKey: 'feature.readingGuide',
  css: READING_GUIDE_CSS,
  classNames: ['pulxon-reading-guide'],
  conflictsWith: ['reading-mask'],
  place: ([bar], pointerY) => {
    bar?.style.setProperty('top', `${pointerY + GUIDE_OFFSET_PX}px`, 'important');
  },
});
