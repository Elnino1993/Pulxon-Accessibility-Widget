import type { FeatureDefinition } from '../core/registry';
import { biggerText } from './bigger-text';
import { highlightLinks } from './highlight-links';
import { pauseAnimations } from './pause-animations';
import { boldText, lineHeight, textAlign, textSpacing } from './text-features';

export { biggerText, boldText, highlightLinks, lineHeight, pauseAnimations, textAlign, textSpacing };

export const builtinFeatures: FeatureDefinition[] = [
  biggerText,
  textSpacing,
  lineHeight,
  textAlign,
  boldText,
  highlightLinks,
  pauseAnimations,
];
