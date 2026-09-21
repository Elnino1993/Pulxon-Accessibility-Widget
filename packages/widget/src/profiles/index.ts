import type { MessageKey } from '../i18n';
import type { ProfileDefinition } from '../core/registry';

/** One line under each profile's name, saying exactly what it turns on. */
export const PROFILE_DESCRIPTIONS: Record<string, MessageKey> = {
  'low-vision': 'profileDesc.lowVision',
  dyslexia: 'profileDesc.dyslexia',
  adhd: 'profileDesc.adhd',
  'seizure-safe': 'profileDesc.seizureSafe',
  keyboard: 'profileDesc.keyboard',
  cognitive: 'profileDesc.cognitive',
};

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
  {
    id: 'cognitive',
    labelKey: 'profile.cognitive',
    features: { 'line-height': 1, 'reading-guide': 1, 'highlight-headings': 1 },
  },
];
