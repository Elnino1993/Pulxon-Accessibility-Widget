import type { FeatureContext, FeatureDefinition } from '../core/registry';
import type { MessageKey } from '../i18n';
import { createPointerOverlay, type OverlayPlacement } from './pointer-overlay';

export const MASK_BAND_PX = 120;
export const GUIDE_OFFSET_PX = 14;

/** Fallback widget z-index (matches `DEFAULT_OPTIONS.zIndex`) used when the context does not supply one. */
export const DEFAULT_WIDGET_Z_INDEX = 2147483000;

/** Keeps a page overlay just below the widget UI's z-index, defaulting when the input is missing or non-finite. */
export function overlayZIndex(widgetZIndex: number | undefined): number {
  const z = Number.isFinite(widgetZIndex) ? Math.trunc(widgetZIndex as number) : DEFAULT_WIDGET_Z_INDEX;
  return Math.max(0, z - 1);
}

function overlayBase(zIndex: number): string {
  return (
    `position:fixed!important;left:0!important;right:0!important;margin:0!important;padding:0!important;` +
    `z-index:${zIndex}!important;pointer-events:none!important`
  );
}

export function readingMaskCss(zIndex: number): string {
  return (
    `.pulxon-reading-mask{${overlayBase(zIndex)};border:0!important;background:rgba(0,0,0,0.6)!important}` +
    '.pulxon-reading-mask--top{top:0!important}' +
    '.pulxon-reading-mask--bottom{bottom:0!important}'
  );
}

export function readingGuideCss(zIndex: number): string {
  return (
    `.pulxon-reading-guide{${overlayBase(zIndex)};height:12px!important;background:rgba(31,75,255,0.3)!important;` +
    'border:0!important;border-top:2px solid #1f4bff!important;border-bottom:2px solid #1f4bff!important}'
  );
}

interface OverlayFeatureInput {
  id: string;
  labelKey: MessageKey;
  css: (zIndex: number) => string;
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
    apply: (ctx: FeatureContext) => {
      const { doc, styles } = ctx;
      styles.set(input.id, input.css(overlayZIndex(ctx.zIndex)));
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
  css: readingMaskCss,
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
  css: readingGuideCss,
  classNames: ['pulxon-reading-guide'],
  conflictsWith: ['reading-mask'],
  place: ([bar], pointerY) => {
    bar?.style.setProperty('top', `${pointerY + GUIDE_OFFSET_PX}px`, 'important');
  },
});
