import { cssFeature, scoped } from './shared';

export const highlightHeadings = cssFeature({
  id: 'highlight-headings',
  group: 'navigation',
  labelKey: 'feature.highlightHeadings',
  levels: 1,
  css: () =>
    `${scoped(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', '[role="heading"]'])}` +
    '{outline:3px dashed #b00020!important;outline-offset:3px!important}',
});

export const focusHighlight = cssFeature({
  id: 'focus-highlight',
  group: 'navigation',
  labelKey: 'feature.focusHighlight',
  levels: 1,
  css: () =>
    `${scoped([':focus-visible'])}` +
    '{outline:4px solid #1f4bff!important;outline-offset:3px!important;box-shadow:0 0 0 7px #ffffff!important}',
});

function svgCursor(svg: string, hotspotX: number, hotspotY: number, fallback: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY},${fallback}`;
}

const ARROW_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>" +
  "<path d='M6 3l30 27H22l8 15-6 3-8-15-10 9z' fill='#000' stroke='#fff' stroke-width='3' stroke-linejoin='round'/></svg>";

const HAND_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>" +
  "<path d='M17 3a4 4 0 0 1 4 4v14l2-1a4 4 0 0 1 4 1l1 1 2-1a4 4 0 0 1 5 2l1 1a4 4 0 0 1 5 3v9c0 7-5 11-12 11h-4" +
  "c-5 0-8-3-10-7l-6-11a3 3 0 0 1 5-3l3 4V7a4 4 0 0 1 4-4z' fill='#000' stroke='#fff' stroke-width='2.5' stroke-linejoin='round'/></svg>";

export const BIG_ARROW_CURSOR = svgCursor(ARROW_SVG, 6, 3, 'auto');
export const BIG_HAND_CURSOR = svgCursor(HAND_SVG, 17, 3, 'pointer');

const INTERACTIVE = [
  'a[href]',
  'a[href] *',
  'button',
  'button *',
  '[role="button"]',
  '[role="button"] *',
  'label',
  'select',
  'summary',
] as const;

export const bigCursor = cssFeature({
  id: 'big-cursor',
  group: 'reading',
  labelKey: 'feature.bigCursor',
  levels: 1,
  css: () =>
    `${scoped(['body', 'body *'])}{cursor:${BIG_ARROW_CURSOR}!important}` +
    `${scoped(INTERACTIVE)}{cursor:${BIG_HAND_CURSOR}!important}`,
});
