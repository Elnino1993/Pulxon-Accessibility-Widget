import { cssFeature, pick, scoped } from './shared';

const ALL_TEXT = ['body', 'body *'] as const;
const BLOCK_TEXT = [
  'p',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'td',
  'th',
  'dt',
  'dd',
  'blockquote',
  'figcaption',
  'caption',
  'label',
] as const;

export const LINE_HEIGHTS = [1.5, 1.75, 2] as const;
export const LETTER_SPACING_EM = [0.12, 0.16, 0.2] as const;
export const WORD_SPACING_EM = [0.16, 0.24, 0.32] as const;
export const TEXT_ALIGNMENTS = ['left', 'right', 'center', 'justify'] as const;

export const boldText = cssFeature({
  id: 'bold-text',
  group: 'text',
  labelKey: 'feature.boldText',
  levels: 1,
  css: () => `${scoped(ALL_TEXT)}{font-weight:700!important}`,
});

export const lineHeight = cssFeature({
  id: 'line-height',
  group: 'text',
  labelKey: 'feature.lineHeight',
  levels: LINE_HEIGHTS.length,
  css: (level) => `${scoped(ALL_TEXT)}{line-height:${pick(LINE_HEIGHTS, level)}!important}`,
});

export const textSpacing = cssFeature({
  id: 'text-spacing',
  group: 'text',
  labelKey: 'feature.textSpacing',
  levels: LETTER_SPACING_EM.length,
  css: (level) =>
    `${scoped(ALL_TEXT)}{letter-spacing:${pick(LETTER_SPACING_EM, level)}em!important;` +
    `word-spacing:${pick(WORD_SPACING_EM, level)}em!important}` +
    `${scoped(['p'])}{margin-bottom:2em!important}`,
});

export const textAlign = cssFeature({
  id: 'text-align',
  group: 'text',
  labelKey: 'feature.textAlign',
  levels: TEXT_ALIGNMENTS.length,
  levelLabelKeys: ['level.left', 'level.right', 'level.center', 'level.justify'],
  css: (level) => `${scoped(BLOCK_TEXT)}{text-align:${pick(TEXT_ALIGNMENTS, level)}!important}`,
});
