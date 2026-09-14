import type { ProfileDefinition } from '../core/registry';

export const builtinProfiles: ProfileDefinition[] = [
  {
    id: 'low-vision',
    labelKey: 'profile.lowVision',
    features: { 'bigger-text': 2, contrast: 2, 'big-cursor': 1 },
  },
  {
    id: 'dyslexia',
    labelKey: 'profile.dyslexia',
    features: { 'dyslexia-font': 1, 'text-spacing': 1 },
  },
  {
    id: 'adhd',
    labelKey: 'profile.adhd',
    features: { 'reading-mask': 1, 'pause-animations': 1, saturation: 1 },
  },
  {
    id: 'seizure-safe',
    labelKey: 'profile.seizureSafe',
    features: { 'pause-animations': 1, saturation: 1 },
  },
  {
    id: 'keyboard',
    labelKey: 'profile.keyboard',
    features: { 'focus-highlight': 1, 'highlight-links': 1 },
  },
];
