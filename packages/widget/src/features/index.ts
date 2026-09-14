import type { FeatureDefinition } from '../core/registry';
import { biggerText } from './bigger-text';
import { contrast, hideImages, saturation } from './color-features';
import { dyslexiaFont } from './dyslexia-font';
import { highlightLinks } from './highlight-links';
import { bigCursor, focusHighlight, highlightHeadings } from './navigation-features';
import { pauseAnimations } from './pause-animations';
import { readingGuide, readingMask } from './reading-overlays';
import { boldText, lineHeight, textAlign, textSpacing } from './text-features';

export {
  bigCursor,
  biggerText,
  boldText,
  contrast,
  dyslexiaFont,
  focusHighlight,
  hideImages,
  highlightHeadings,
  highlightLinks,
  lineHeight,
  pauseAnimations,
  readingGuide,
  readingMask,
  saturation,
  textAlign,
  textSpacing,
};

export const builtinFeatures: FeatureDefinition[] = [
  biggerText,
  textSpacing,
  lineHeight,
  textAlign,
  dyslexiaFont,
  boldText,
  contrast,
  saturation,
  highlightLinks,
  highlightHeadings,
  focusHighlight,
  readingMask,
  readingGuide,
  bigCursor,
  pauseAnimations,
  hideImages,
];
