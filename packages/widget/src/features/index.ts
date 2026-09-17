import type { FeatureDefinition } from '../core/registry';
import { biggerText } from './bigger-text';
import { contrast, hideImages, saturation } from './color-features';
import { dictionary } from './dictionary';
import { dyslexiaFont } from './dyslexia-font';
import { highlightLinks } from './highlight-links';
import { bigCursor, focusHighlight, highlightHeadings } from './navigation-features';
import { pauseAnimations } from './pause-animations';
import { readAloud } from './read-aloud';
import { readingGuide, readingMask } from './reading-overlays';
import { boldText, lineHeight, textAlign, textSpacing } from './text-features';
import { tooltips } from './tooltips';
import { voiceNavigation } from './voice-navigation';

export {
  bigCursor,
  biggerText,
  boldText,
  contrast,
  dictionary,
  dyslexiaFont,
  focusHighlight,
  hideImages,
  highlightHeadings,
  highlightLinks,
  lineHeight,
  pauseAnimations,
  readAloud,
  readingGuide,
  readingMask,
  saturation,
  textAlign,
  textSpacing,
  tooltips,
  voiceNavigation,
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
  tooltips,
  highlightHeadings,
  focusHighlight,
  voiceNavigation,
  readAloud,
  readingMask,
  readingGuide,
  dictionary,
  bigCursor,
  pauseAnimations,
  hideImages,
];
