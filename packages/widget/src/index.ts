export { VERSION } from './version';
export { createWidget, type CreateWidgetInput } from './create-widget';
export type { PulxonApi, PulxonEvents } from './api';
export {
  DEFAULT_OPTIONS,
  parseDataAttributes,
  resolveOptions,
  type Position,
  type WidgetOptions,
} from './config/options';
export type { FeatureContext, FeatureDefinition, FeatureGroup, ProfileDefinition } from './core/registry';
export type { Settings } from './core/store';
export { builtinFeatures, highlightLinks, pauseAnimations } from './features';
