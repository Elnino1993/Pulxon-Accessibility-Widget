import type { FeatureDefinition } from '../core/registry';
import { biggerText } from './bigger-text';
import { dyslexiaFont } from './dyslexia-font';
import { highlightLinks } from './highlight-links';
import { pauseAnimations } from './pause-animations';
import { boldText, lineHeight, textAlign, textSpacing } from './text-features';

export { biggerText, boldText, dyslexiaFont, highlightLinks, lineHeight, pauseAnimations, textAlign, textSpacing };

export const builtinFeatures: FeatureDefinition[] = [
  biggerText,
  textSpacing,
  lineHeight,
  textAlign,
  dyslexiaFont,
  boldText,
  highlightLinks,
  pauseAnimations,
];
