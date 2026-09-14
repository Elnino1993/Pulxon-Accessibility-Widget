import type { FeatureDefinition } from '../core/registry';
import { highlightLinks } from './highlight-links';
import { pauseAnimations } from './pause-animations';
import { boldText, lineHeight, textAlign, textSpacing } from './text-features';

export { boldText, highlightLinks, lineHeight, pauseAnimations, textAlign, textSpacing };

export const builtinFeatures: FeatureDefinition[] = [
  textSpacing,
  lineHeight,
  textAlign,
  boldText,
  highlightLinks,
  pauseAnimations,
];
