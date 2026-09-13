import type { FeatureDefinition } from '../core/registry';
import { highlightLinks } from './highlight-links';
import { pauseAnimations } from './pause-animations';

export { highlightLinks, pauseAnimations };

export const builtinFeatures: FeatureDefinition[] = [highlightLinks, pauseAnimations];
